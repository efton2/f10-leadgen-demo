import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { proposalToHtml, followUp24Html, finalNoticeHtml } from "@/lib/email/templates";
import { sendTelegram } from "@/lib/telegram";

const ACE_URL = "https://ace-f10.pages.dev";
// NOTE: only f10strategy.com is verified in Resend (checked 2026-07-02).
// Switch to proposals@simporic.com once that domain is added and verified.
const FROM = "Simporic <proposals@f10strategy.com>";

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

  // 2. Schedule 24-hour follow-up
  const followUp24At = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `Quick question about the ${businessName} proposal`,
    html: followUp24Html(businessName, aceLink),
    scheduledAt: followUp24At,
  });

  // 3. Schedule day-5 final notice
  const finalNoticeAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `Last note on the ${businessName} proposal`,
    html: finalNoticeHtml(businessName, aceLink),
    scheduledAt: finalNoticeAt,
  });

  // 4. Log to Supabase
  await supabase.from("proposal_sends").insert({
    place_id: placeId ?? null,
    business_name: businessName,
    recipient_email: to,
    niche: niche ?? null,
    proposal_text: proposal,
    status: "sent",
  });

  // 5. Telegram alert to Efton
  await sendTelegramAlert(businessName, to, niche ?? "");

  return NextResponse.json({ success: true });
}
