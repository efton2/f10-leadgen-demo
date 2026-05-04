import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

const ACE_URL = "https://ace-f10.pages.dev";

function proposalToHtml(proposal: string, businessName: string): string {
  const lines = proposal.split("\n");
  let html = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---" || trimmed.startsWith("# ") || trimmed.toLowerCase().startsWith("prepared by")) continue;
    if (trimmed.startsWith("## ")) {
      html += `<h2 style="font-family:Georgia,serif;font-size:18px;color:#1C1917;margin:28px 0 8px;">${trimmed.slice(3)}</h2>`;
    } else {
      html += `<p style="font-family:Arial,sans-serif;font-size:14px;color:#4B5563;line-height:1.7;margin:0 0 12px;">${trimmed}</p>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#4A6FA5;padding:28px 36px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,0.2);border-radius:50%;width:32px;height:32px;text-align:center;vertical-align:middle;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#FFFFFF;">F10</span>
                </td>
                <td style="padding-left:12px;">
                  <span style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#FFFFFF;">AI Operator Systems</span>
                </td>
              </tr>
            </table>
            <p style="font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);margin:12px 0 0;">AI Receptionist Proposal for ${businessName}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            ${html}
          </td>
        </tr>

        <!-- Pricing callout -->
        <tr>
          <td style="padding:0 36px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;border-radius:8px;padding:20px 24px;">
              <tr>
                <td style="text-align:center;">
                  <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#4A6FA5;margin:0 0 4px;">$497 setup &nbsp;+&nbsp; $297/month</p>
                  <p style="font-family:Arial,sans-serif;font-size:12px;color:#6B7280;margin:0;">No long-term contract. Cancel any time. Live in 48 hours.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F7F9FC;border-top:1px solid #E5E0D8;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Function 10 Media LLC &nbsp;&bull;&nbsp; AI Operator Systems &nbsp;&bull;&nbsp; function10media.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function followUp24Html(businessName: string, aceUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">
        <tr>
          <td style="background:#4A6FA5;padding:24px 36px;">
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#FFFFFF;">AI Operator Systems</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#1C1917;margin:0 0 20px;">Did you get a chance to look at the proposal?</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#4B5563;line-height:1.7;margin:0 0 16px;">We put together something specific for ${businessName}. If you had any questions come up after reading it, our AI is available right now to walk you through the details at no pressure.</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#4B5563;line-height:1.7;margin:0 0 28px;">No sales pitch. Just answers.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#4A6FA5;border-radius:8px;padding:14px 28px;">
                  <a href="${aceUrl}" style="font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Talk to ACE Right Now</a>
                </td>
              </tr>
            </table>
            <p style="font-family:Arial,sans-serif;font-size:12px;color:#9CA3AF;margin:20px 0 0;">Available 24 hours a day. No hold times. No voicemail.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#F7F9FC;border-top:1px solid #E5E0D8;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Function 10 Media LLC &nbsp;&bull;&nbsp; AI Operator Systems</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function finalNoticeHtml(businessName: string, aceUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">
        <tr>
          <td style="background:#4A6FA5;padding:24px 36px;">
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#FFFFFF;">AI Operator Systems</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#1C1917;margin:0 0 20px;">Last note on the ${businessName} proposal</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#4B5563;line-height:1.7;margin:0 0 16px;">We are wrapping up our outreach this week and wanted to make sure this did not fall through the cracks. The $497 setup rate we quoted is what we hold for businesses we reach out to directly. After this week it goes back to standard pricing.</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#4B5563;line-height:1.7;margin:0 0 28px;">If the timing is not right, no problem. If you have questions before deciding, ACE can answer them right now.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#4A6FA5;border-radius:8px;padding:14px 28px;">
                  <a href="${aceUrl}" style="font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Talk to ACE</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#F7F9FC;border-top:1px solid #E5E0D8;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Function 10 Media LLC &nbsp;&bull;&nbsp; AI Operator Systems</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendTelegramAlert(businessName: string, recipientEmail: string, niche: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

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
    "Track at app.f10strategy.com/pipeline",
  ].join("\n");

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
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
    from: "F10 AI Operator Systems <proposals@aioperatorsystems.com>",
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
    from: "F10 AI Operator Systems <proposals@aioperatorsystems.com>",
    to: [to],
    subject: `Quick question about the ${businessName} proposal`,
    html: followUp24Html(businessName, aceLink),
    scheduledAt: followUp24At,
  });

  // 3. Schedule day-5 final notice
  const finalNoticeAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  await resend.emails.send({
    from: "F10 AI Operator Systems <proposals@aioperatorsystems.com>",
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
