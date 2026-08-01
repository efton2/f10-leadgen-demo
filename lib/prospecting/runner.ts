// Tick runner: advances prospecting leads one enrichment step at a time
// within a time budget. Driven by the batch page polling /api/prospecting/tick
// while open (works on any Vercel plan); a cron wrapper can also call runTick.
import { supabase } from "@/lib/supabase";
import { getLeadDetail } from "@/app/lib/getLeadDetail";
import {
  scrapeWebsite,
  extractContactEmails,
  runAudit,
  buildAuditHtml,
  cleanUrl,
} from "@/lib/enrichment/websiteAudit";
import {
  scrapeGoogleMaps,
  crawlCompetitorSite,
  synthesize,
  buildCompetitiveHtml,
} from "@/lib/enrichment/competitive";
import { generateProposal } from "@/lib/enrichment/proposal";
import { generateEmailSequence, OutreachEmail } from "@/lib/enrichment/emails";
import { UsageMeter, mergeUsage, UsageSnapshot } from "@/lib/usage";
import { sendTelegram } from "@/lib/telegram";
import { qualifiesForAutoApprove } from "@/lib/prospecting/autoApprove";
import { isSuppressed } from "@/lib/suppression";

const WORKING_STATUSES = ["queued", "details_done", "audited", "competitive_done", "proposal_done"];
const TIME_BUDGET_MS = 240_000;
const STALE_CLAIM_MS = 10 * 60_000;
const MAX_ATTEMPTS = 2;

interface LeadRow {
  id: string;
  batch_id: string;
  place_id: string;
  business_name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  review_count: number;
  category: string;
  contact_email: string;
  status: string;
  attempt_count: number;
  snapshot: string;
  audit_score: number | null;
  audit_json: Record<string, unknown> | null;
  usage: Partial<UsageSnapshot> | null;
  cost_usd: number;
}

interface BatchRow {
  id: string;
  niche: string;
  city: string;
  competitive_depth: string;
  status: string;
  actual_usage: Partial<UsageSnapshot> | null;
  actual_cost_usd: number;
  telegram_notified: boolean;
}

export async function runTick(batchId: string): Promise<{ processed: number; remaining: number; batchStatus: string }> {
  const deadline = Date.now() + TIME_BUDGET_MS;
  let processed = 0;

  const { data: batch } = await supabase
    .from("prospecting_batches")
    .select("id,niche,city,competitive_depth,status,actual_usage,actual_cost_usd,telegram_notified")
    .eq("id", batchId)
    .single();

  if (!batch) return { processed: 0, remaining: 0, batchStatus: "not_found" };

  while (Date.now() < deadline) {
    const lead = await claimNextLead(batchId);
    if (!lead) break;

    const meter = new UsageMeter();
    try {
      await executeStep(lead, batch as BatchRow, meter);
      processed++;
    } catch (err) {
      const attempts = (lead.attempt_count ?? 0) + 1;
      await supabase
        .from("prospecting_leads")
        .update({
          attempt_count: attempts,
          error: String(err).slice(0, 1000),
          status: attempts >= MAX_ATTEMPTS ? "failed" : lead.status,
          processing_at: null,
        })
        .eq("id", lead.id);
    }

    // Roll usage into lead + batch actuals
    const snap = meter.toJSON();
    if (snap.cost_usd > 0 || snap.claude_in_tokens > 0 || snap.apify_usd > 0 || snap.places_calls > 0) {
      const leadUsage = mergeUsage(lead.usage, snap);
      await supabase
        .from("prospecting_leads")
        .update({ usage: leadUsage, cost_usd: leadUsage.cost_usd })
        .eq("id", lead.id);

      const { data: freshBatch } = await supabase
        .from("prospecting_batches")
        .select("actual_usage")
        .eq("id", batchId)
        .single();
      const batchUsage = mergeUsage(freshBatch?.actual_usage, snap);
      await supabase
        .from("prospecting_batches")
        .update({ actual_usage: batchUsage, actual_cost_usd: batchUsage.cost_usd })
        .eq("id", batchId);
    }
  }

  // Remaining work + batch completion
  const { count: remaining } = await supabase
    .from("prospecting_leads")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .in("status", WORKING_STATUSES);

  let batchStatus = batch.status as string;
  if ((remaining ?? 0) === 0 && batch.status === "running") {
    batchStatus = "ready_for_review";
    await supabase.from("prospecting_batches").update({ status: batchStatus }).eq("id", batchId);

    if (!batch.telegram_notified) {
      const { data: allLeads } = await supabase
        .from("prospecting_leads")
        .select("status,contact_email")
        .eq("batch_id", batchId);
      const ready = (allLeads ?? []).filter((l) => l.status === "ready");
      const autoQueued = (allLeads ?? []).filter((l) => l.status === "auto_queued");
      const noEmail = ready.filter((l) => !l.contact_email).length;
      const failed = (allLeads ?? []).filter((l) => l.status === "failed").length;
      await sendTelegram(
        [
          "🔎 BATCH READY FOR REVIEW",
          "",
          `${batch.niche} / ${batch.city}`,
          `${ready.length} ready for manual review, ${autoQueued.length} auto-queued, ${noEmail} missing email, ${failed} failed`,
          "",
          `Review at simporic.com/prospecting/${batchId}`,
          autoQueued.length ? `Auto-queued leads at simporic.com/prospecting/digest` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      await supabase.from("prospecting_batches").update({ telegram_notified: true }).eq("id", batchId);
    }
  }

  return { processed, remaining: remaining ?? 0, batchStatus };
}

// Claim the next workable lead via a conditional update on processing_at so
// concurrent ticks (page poll + optional cron) never double-work a lead.
async function claimNextLead(batchId: string): Promise<LeadRow | null> {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();

  const { data: candidates } = await supabase
    .from("prospecting_leads")
    .select("id,processing_at,attempt_count,status")
    .eq("batch_id", batchId)
    .in("status", WORKING_STATUSES)
    .or(`processing_at.is.null,processing_at.lt.${staleBefore}`)
    .order("created_at", { ascending: true })
    .limit(5);

  for (const c of candidates ?? []) {
    const claimFilter = supabase
      .from("prospecting_leads")
      .update({ processing_at: new Date().toISOString() })
      .eq("id", c.id);
    // Only claim if still unclaimed (or stale) at write time
    const { data: claimed } = await (c.processing_at
      ? claimFilter.eq("processing_at", c.processing_at)
      : claimFilter.is("processing_at", null)
    )
      .select(
        "id,batch_id,place_id,business_name,address,phone,website,rating,review_count,category,contact_email,status,attempt_count,snapshot,audit_score,audit_json,usage,cost_usd"
      )
      .single();
    if (claimed) return claimed as LeadRow;
  }
  return null;
}

async function executeStep(lead: LeadRow, batch: BatchRow, meter: UsageMeter): Promise<void> {
  switch (lead.status) {
    case "queued": {
      const detail = await getLeadDetail(lead.place_id);
      meter.addPlaces(1);
      if (!detail) throw new Error("Places details lookup failed");
      await advance(lead.id, "details_done", {
        phone: detail.phone || lead.phone,
        website: detail.website || "",
        snapshot: detail.snapshot || "",
        business_name: detail.name || lead.business_name,
        address: detail.address || lead.address,
      });
      break;
    }

    case "details_done": {
      let content = "";
      let email = "";
      if (lead.website) {
        const scraped = await scrapeWebsite(lead.website, meter);
        content = scraped.content;
        email = extractContactEmails(scraped.rawHtmlPages, lead.website, scraped.content);
      }
      const audit = await runAudit(lead.business_name, lead.website ? cleanUrl(lead.website) : "(no website)", content, meter);
      const html = buildAuditHtml(lead.business_name, lead.website ? cleanUrl(lead.website) : "", audit);
      await advance(lead.id, "audited", {
        audit_score: audit.overall_score,
        audit_json: audit,
        audit_html: html,
        ...(email ? { contact_email: email, email_source: "scraped" } : {}),
      });
      break;
    }

    case "audited": {
      // Competitors: top 3 sibling leads in this batch by review count
      const { data: siblings } = await supabase
        .from("prospecting_leads")
        .select("business_name,rating,review_count,address,website")
        .eq("batch_id", lead.batch_id)
        .neq("id", lead.id)
        .neq("status", "skipped_duplicate")
        .order("review_count", { ascending: false })
        .limit(3);

      let competitorsRaw: object[];
      if (batch.competitive_depth === "full") {
        competitorsRaw = await Promise.all(
          (siblings ?? []).map(async (s) => {
            const maps = await scrapeGoogleMaps(s.business_name, batch.city, meter);
            const websiteText = await crawlCompetitorSite(maps.website as string | null, meter);
            return { ...maps, website_text: websiteText };
          })
        );
      } else {
        competitorsRaw = (siblings ?? []).map((s) => ({
          name: s.business_name,
          rating: s.rating,
          review_count: s.review_count,
          address: s.address,
          website: s.website,
          website_text: "",
        }));
      }

      const industry = lead.category || batch.niche;
      const synthesis = await synthesize(
        lead.business_name,
        industry,
        batch.city,
        "F10 Strategy",
        competitorsRaw,
        meter
      );
      const html = buildCompetitiveHtml(
        { client_name: lead.business_name, industry, market_display: batch.city, ...synthesis },
        "f10_strategy"
      );
      await advance(lead.id, "competitive_done", {
        competitive_json: synthesis,
        competitive_html: html,
      });
      break;
    }

    case "competitive_done": {
      const proposal = await generateProposal(
        {
          name: lead.business_name,
          niche: lead.category || batch.niche,
          address: lead.address,
          rating: lead.rating,
          reviewCount: lead.review_count,
          phone: lead.phone,
          website: lead.website,
          snapshot: lead.snapshot,
        },
        meter
      );
      await advance(lead.id, "proposal_done", { proposal_md: proposal });
      break;
    }

    case "proposal_done": {
      const auditJson = lead.audit_json as { findings?: Array<{ severity: string; title: string; detail: string }> } | null;
      const emails: OutreachEmail[] = await generateEmailSequence(
        {
          businessName: lead.business_name,
          category: lead.category || batch.niche,
          city: batch.city,
          snapshot: lead.snapshot,
          auditScore: lead.audit_score,
          auditFindings: auditJson?.findings ?? [],
        },
        meter
      );

      // Additive auto-queue check: does NOT send anything by itself, only
      // decides which review queue the lead lands in. Suppressed addresses
      // never auto-queue, regardless of score — they still land in 'ready'
      // for a human to see the suppression reason if desired.
      const suppressed = lead.contact_email ? await isSuppressed(lead.contact_email) : false;
      const autoQualifies =
        !suppressed &&
        qualifiesForAutoApprove({
          auditScore: lead.audit_score,
          contactEmail: lead.contact_email,
          emailsGenerated: emails.length === 3,
        });

      await advance(lead.id, autoQualifies ? "auto_queued" : "ready", { emails });
      break;
    }

    default:
      // Nothing to do (terminal or review state) — release the claim
      await supabase.from("prospecting_leads").update({ processing_at: null }).eq("id", lead.id);
  }
}

async function advance(leadId: string, nextStatus: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("prospecting_leads")
    .update({ ...updates, status: nextStatus, processing_at: null, error: "" })
    .eq("id", leadId);
  if (error) throw new Error(`Failed to advance lead: ${error.message}`);
}
