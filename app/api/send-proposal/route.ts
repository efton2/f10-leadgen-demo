import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

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

export async function POST(req: NextRequest) {
  const { to, businessName, proposal } = await req.json();

  if (!to || !businessName || !proposal) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = proposalToHtml(proposal, businessName);

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

  return NextResponse.json({ success: true });
}
