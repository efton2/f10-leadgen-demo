import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { wrapOutreachEmail, proposalToHtml } from "@/lib/email/templates";
import { sendTelegram } from "@/lib/telegram";
import { isSuppressed } from "@/lib/suppression";

const ACE_URL = "https://ace-f10.pages.dev";
// Display name is the real company (F10 Strategy) -- Simporic is an internal
// tool name only, never shown to prospects (corrected 2026-08-01).
const FROM = "F10 Strategy <proposals@f10strategy.com>";

interface OutreachEmail {
  n: number;
  subject: string;
  body_md: string;
  send_offset_days: number;
}

export type SendOutreachResult =
  | { ok: true; followUpError?: string }
  | { ok: false; error: string; status: number };

// THE ONLY SENDER in the prospecting engine, shared by the manual
// per-lead approve route ('ready'->'approved') and the digest batch-approve
// route ('auto_queued'->'approved'). Hard gate: atomic fromStatus->approved
// transition requiring a non-empty contact_email, enforced in the database
// update itself, so double-clicks, stale tabs, and races send nothing twice.
export async function sendOutreachSequence(
  leadId: string,
  fromStatus: "ready" | "auto_queued"
): Promise<SendOutreachResult> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "Resend not configured", status: 500 };
  }

  // 0. Suppression check — read-only, ahead of the atomic gate below so a
  // suppressed address never flips status in the first place. Small race
  // window against a webhook landing mid-request is acceptable at this
  // volume.
  const { data: precheck } = await supabase
    .from("prospecting_leads")
    .select("contact_email")
    .eq("id", leadId)
    .maybeSingle();
  if (precheck?.contact_email && (await isSuppressed(precheck.contact_email as string))) {
    return { ok: false, error: "Recipient is on the suppression list (prior bounce/complaint)", status: 403 };
  }

  // 1. Atomic approval gate
  const { data: lead, error: gateError } = await supabase
    .from("prospecting_leads")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("status", fromStatus)
    .neq("contact_email", "")
    .select("*")
    .single();

  if (gateError || !lead) {
    return {
      ok: false,
      error: "Lead is not approvable (already sent, not in the expected queue, or missing email)",
      status: 409,
    };
  }

  const emails = (lead.emails ?? []) as OutreachEmail[];
  const e1 = emails.find((e) => e.n === 1);
  const e2 = emails.find((e) => e.n === 2);
  const e3 = emails.find((e) => e.n === 3);
  if (!e1 || !e2 || !e3) {
    await supabase.from("prospecting_leads").update({ status: fromStatus, approved_at: null }).eq("id", leadId);
    return { ok: false, error: "Lead is missing email drafts", status: 400 };
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

  const { data: sent1, error: sendError } = await resend.emails.send({
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
      .update({ status: fromStatus, approved_at: null, error: `Send failed: ${sendError.message ?? sendError}` })
      .eq("id", leadId);
    return { ok: false, error: `Send failed: ${sendError.message ?? "Resend error"}`, status: 502 };
  }

  if (sent1?.id) {
    await supabase.from("prospecting_sends").insert({
      lead_id: leadId,
      email_number: 1,
      recipient_email: to,
      resend_message_id: sent1.id,
    });
  }

  // 3+4. Schedule follow-ups. Failures here leave status 'approved' with error
  // set — email 1 is out and must never re-fire.
  let followUpError = "";
  try {
    const at2 = new Date(Date.now() + Math.max(e2.send_offset_days, 1) * 24 * 60 * 60 * 1000).toISOString();
    const proposalHtml = lead.proposal_md
      ? proposalToHtml(lead.proposal_md as string, businessName)
      : wrapOutreachEmail(e2.body_md, businessName);
    const { data: sent2 } = await resend.emails.send({
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
    if (sent2?.id) {
      await supabase.from("prospecting_sends").insert({
        lead_id: leadId,
        email_number: 2,
        recipient_email: to,
        resend_message_id: sent2.id,
      });
    }

    const at3 = new Date(Date.now() + Math.max(e3.send_offset_days, 2) * 24 * 60 * 60 * 1000).toISOString();
    const body3 = e3.body_md.includes(ACE_URL) ? e3.body_md : `${e3.body_md}\n\n[Talk to ACE](${aceLink})`;
    const { data: sent3 } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: e3.subject,
      html: wrapOutreachEmail(body3, businessName),
      scheduledAt: at3,
    });
    if (sent3?.id) {
      await supabase.from("prospecting_sends").insert({
        lead_id: leadId,
        email_number: 3,
        recipient_email: to,
        resend_message_id: sent3.id,
      });
    }
  } catch (err) {
    followUpError = `Follow-up scheduling failed: ${String(err)}`;
  }

  // 5. Log the send
  const { error: logError } = await supabase.from("proposal_sends").insert({
    place_id: lead.place_id ?? null,
    business_name: businessName,
    recipient_email: to,
    niche: category || null,
    proposal_text: (lead.proposal_md as string) ?? "",
    status: "sent",
  });
  if (logError) {
    // Non-fatal — the email already sent successfully, don't fail the
    // request over an audit-log write. But it must not be silent.
    console.error("[sendOutreachSequence] Failed to log proposal_sends:", logError);
  }

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
    .eq("id", leadId);

  await sendTelegram(
    [
      fromStatus === "auto_queued" ? "🎯 AUTO-APPROVED OUTREACH SENT (digest)" : "🎯 PROSPECTING OUTREACH SENT",
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

  return { ok: true, followUpError: followUpError || undefined };
}
