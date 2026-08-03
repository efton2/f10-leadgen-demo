import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { proposalToHtml, followUp24Html, finalNoticeHtml } from "@/lib/email/templates";
import { sendTelegram } from "@/lib/telegram";

const ACE_URL = "https://ace-f10.pages.dev";
// Display name is the real company (F10 Strategy) -- Simporic is an internal
// tool name only, never shown to prospects (corrected 2026-08-01).
const FROM = "F10 Strategy <proposals@f10strategy.com>";

async function sendTelegramAlert(businessName: string, recipientEmail: string, niche: string) {
  const message = [
    "🎯 PROPOSAL SENT",
    "",
    `Business: ${businessName}`,
    `Category: ${niche || "Unknown"}`,
    `Recipient: ${recipientEmail}`,
    "",
    "Follow-up sequence active:",
    "  24hr: ACE follow-up email scheduled",
    "  Day 5: Final notice scheduled",
    "",
    "Track at simporic.com/pipeline",
  ].join("\n");

  await sendTelegram(message);
}

export async function POST(req: NextRequest) {
  const { to, businessName, proposal, placeId, niche } = await req.json();

  if (!to || !businessName || !proposal) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const aceLink = `${ACE_URL}?business=${encodeURIComponent(businessName)}&category=${encodeURIComponent(niche || "")}`;
  const html = proposalToHtml(proposal, businessName);

  // 0. Idempotency guard — a client-side retry after a follow-up-scheduling
  // error (see below) used to re-fire the already-successful initial email
  // with no way to tell. Refuse a second send to the same recipient/business.
  const { data: existingSend } = await supabase
    .from("proposal_sends")
    .select("id")
    .eq("recipient_email", to)
    .eq("business_name", businessName)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();

  if (existingSend) {
    return NextResponse.json({ success: true, alreadySent: true });
  }

  // 1. Send the proposal email now
  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `AI Receptionist Proposal for ${businessName}`,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  // 2-3. Schedule follow-ups. Wrapped so a transient Resend failure here
  // can't crash the handler before logging/alerting — the initial email
  // already went out and must not be silently unrecorded (or, worse,
  // re-sent by a client retry that saw this request fail).
  let followUpError = "";
  try {
    const followUp24At = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `Quick question about the ${businessName} proposal`,
      html: followUp24Html(businessName, aceLink),
      scheduledAt: followUp24At,
    });

    const finalNoticeAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `Last note on the ${businessName} proposal`,
      html: finalNoticeHtml(businessName, aceLink),
      scheduledAt: finalNoticeAt,
    });
  } catch (err) {
    followUpError = `Follow-up scheduling failed: ${String(err)}`;
    console.error("[send-proposal]", followUpError);
  }

  // 4. Log to Supabase
  const { error: logError } = await supabase.from("proposal_sends").insert({
    place_id: placeId ?? null,
    business_name: businessName,
    recipient_email: to,
    niche: niche ?? null,
    proposal_text: proposal,
    status: "sent",
  });
  if (logError) {
    console.error("[send-proposal] Failed to log proposal_sends:", logError);
  }

  // 5. Telegram alert to Efton
  await sendTelegramAlert(businessName, to, niche ?? "");

  return NextResponse.json({ success: true, followUpError: followUpError || undefined });
}
