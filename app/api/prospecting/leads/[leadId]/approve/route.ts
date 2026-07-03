import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { wrapOutreachEmail, proposalToHtml } from "@/lib/email/templates";
import { sendTelegram } from "@/lib/telegram";

const ACE_URL = "https://ace-f10.pages.dev";
// NOTE: only f10strategy.com is verified in Resend (checked 2026-07-02).
// Switch to proposals@simporic.com once that domain is added and verified.
const FROM = "Simporic <proposals@f10strategy.com>";

interface OutreachEmail {
  n: number;
  subject: string;
  body_md: string;
  send_offset_days: number;
}

// POST /api/prospecting/leads/[leadId]/approve — THE ONLY SENDER in the
// prospecting engine. Hard gate: atomic ready->approved transition requiring
// a non-empty contact_email, enforced in the database update itself, so
// double-clicks, stale tabs, and races send nothing twice.
export async function POST(_req: NextRequest, { params }: { params: { leadId: string } }) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }

  // 1. Atomic approval gate
  const { data: lead, error: gateError } = await supabase
    .from("prospecting_leads")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", params.leadId)
    .eq("status", "ready")
    .neq("contact_email", "")
    .select("*")
    .single();

  if (gateError || !lead) {
    return NextResponse.json(
      { error: "Lead is not approvable (already sent, not ready, or missing email)" },
      { status: 409 }
    );
  }

  const emails = (lead.emails ?? []) as OutreachEmail[];
  const e1 = emails.find((e) => e.n === 1);
  const e2 = emails.find((e) => e.n === 2);
  const e3 = emails.find((e) => e.n === 3);
  if (!e1 || !e2 || !e3) {
    await supabase.from("prospecting_leads").update({ status: "ready", approved_at: null }).eq("id", params.leadId);
    return NextResponse.json({ error: "Lead is missing email drafts" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = lead.contact_email as string;
  const businessName = lead.business_name as string;
  const category = (lead.category as string) ?? "";
  const aceLink = `${ACE_URL}?business=${encodeURIComponent(businessName)}&category=${encodeURIComponent(category)}`;

  // 2. Email 1 now — audit hook, audit report attached
  const attachments = lead.audit_html
    ? [{
        filename: `Marketing-Audit-${businessName.replace(/[^a-zA-Z0-9]+/g, "-")}.html`,
        content: Buffer.from(lead.audit_html as string).toString("base64"),
      }]
    : undefined;

  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: e1.subject,
    html: wrapOutreachEmail(e1.body_md, businessName),
    attachments,
  });

  if (sendError) {
    // Roll the gate back — nothing was sent
    await supabase
      .from("prospecting_leads")
      .update({ status: "ready", approved_at: null, error: `Send failed: ${sendError.message ?? sendError}` })
      .eq("id", params.leadId);
    return NextResponse.json({ error: `Send failed: ${sendError.message ?? "Resend error"}` }, { status: 502 });
  }

  // 3+4. Schedule follow-ups. Failures here leave status 'approved' with error
  // set — email 1 is out and must never re-fire.
  let followUpError = "";
  try {
    const at2 = new Date(Date.now() + Math.max(e2.send_offset_days, 1) * 24 * 60 * 60 * 1000).toISOString();
    const proposalHtml = lead.proposal_md
      ? proposalToHtml(lead.proposal_md as string, businessName)
      : wrapOutreachEmail(e2.body_md, businessName);
    await resend.emails.send({
      from: FROM,
      to: [to],
      subject: e2.subject,
      html: wrapOutreachEmail(e2.body_md, businessName),
      attachments: lead.proposal_md
        ? [{
            filename: `Proposal-${businessName.replace(/[^a-zA-Z0-9]+/g, "-")}.html`,
            content: Buffer.from(proposalHtml).toString("base64"),
          }]
        : undefined,
      scheduledAt: at2,
    });

    const at3 = new Date(Date.now() + Math.max(e3.send_offset_days, 2) * 24 * 60 * 60 * 1000).toISOString();
    const body3 = e3.body_md.includes(ACE_URL) ? e3.body_md : `${e3.body_md}\n\n[Talk to ACE](${aceLink})`;
    await resend.emails.send({
      from: FROM,
      to: [to],
      subject: e3.subject,
      html: wrapOutreachEmail(body3, businessName),
      scheduledAt: at3,
    });
  } catch (err) {
    followUpError = `Follow-up scheduling failed: ${String(err)}`;
  }

  // 5. Log the send
  await supabase.from("proposal_sends").insert({
    place_id: lead.place_id ?? null,
    business_name: businessName,
    recipient_email: to,
    niche: category || null,
    proposal_text: (lead.proposal_md as string) ?? "",
    status: "sent",
  });

  // 6. Upsert into the main pipeline
  await supabase.from("pipeline_leads").upsert(
    {
      place_id: lead.place_id,
      business_name: businessName,
      address: lead.address ?? "",
      phone: lead.phone ?? "",
      rating: lead.rating ?? 0,
      review_count: lead.review_count ?? 0,
      category,
      city: "",
      status: "proposal_sent",
      source: "prospecting",
    },
    { onConflict: "place_id" }
  );

  // 7. Finalize lead + alert
  await supabase
    .from("prospecting_leads")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      error: followUpError,
    })
    .eq("id", params.leadId);

  await sendTelegram(
    [
      "🎯 PROSPECTING OUTREACH SENT",
      "",
      `Business: ${businessName}`,
      `Category: ${category || "Unknown"}`,
      `Recipient: ${to}`,
      lead.audit_score != null ? `Audit score: ${lead.audit_score}/100 (report attached)` : "",
      "",
      "Sequence:",
      "  Now: audit hook + report",
      `  +${Math.max(e2.send_offset_days, 1)}d: proposal`,
      `  +${Math.max(e3.send_offset_days, 2)}d: ACE invite`,
      followUpError ? `⚠️ ${followUpError}` : "",
      "",
      "Track at simporic.com/pipeline",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return NextResponse.json({ success: true, followUpError: followUpError || undefined });
}
