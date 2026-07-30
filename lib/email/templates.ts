// Shared Simporic email templates. Extracted from app/api/send-proposal/route.ts
// so both the manual proposal flow and the prospecting engine use one shell.

import { PRICING } from "@/lib/pricing";

// customerName/businessName in the review-request emails come straight from
// user input (POST body / Google Places), with no sanitization upstream —
// escape before interpolating into HTML so a name like `<img src=x onerror=..>`
// can't inject markup into an email sent on behalf of the client's business.
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function proposalToHtml(proposal: string, businessName: string): string {
  const lines = proposal.split("\n");
  let html = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---" || trimmed.startsWith("# ") || trimmed.toLowerCase().startsWith("prepared by")) continue;
    if (trimmed.startsWith("## ")) {
      html += `<h2 style="font-family:Georgia,serif;font-size:18px;color:#F5EFE6;margin:28px 0 8px;">${trimmed.slice(3)}</h2>`;
    } else {
      html += `<p style="font-family:Arial,sans-serif;font-size:14px;color:#F5EFE6;line-height:1.7;margin:0 0 12px;">${trimmed}</p>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1520;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1520;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#162C42;border-radius:12px;border:1px solid #264766;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#0A1520;padding:28px 36px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,0.2);border-radius:50%;width:32px;height:32px;text-align:center;vertical-align:middle;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#FFFFFF;">F10</span>
                </td>
                <td style="padding-left:12px;">
                  <span style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#FFFFFF;">Simporic</span>
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
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1520;border:1px solid #264766;border-radius:8px;padding:20px 24px;">
              <tr>
                <td style="text-align:center;">
                  <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#E8A020;margin:0 0 4px;">$${PRICING.standard.setup} setup &nbsp;+&nbsp; $${PRICING.standard.monthly}/month</p>
                  <p style="font-family:Arial,sans-serif;font-size:12px;color:#9CA3AF;margin:0;">No long-term contract. Cancel any time. Live in 48 hours.</p>
                </td>
              </tr>
            </table>
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:10px 0 0;text-align:center;">Multi-location or higher call volume? Ask about Managed: $${PRICING.managed.setup} setup, $${PRICING.managed.monthly}/month, dedicated optimization.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#060D16;border-top:1px solid #264766;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Simporic &nbsp;&bull;&nbsp; simporic.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function followUp24Html(businessName: string, aceUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1520;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1520;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#162C42;border-radius:12px;border:1px solid #264766;overflow:hidden;">
        <tr>
          <td style="background:#0A1520;padding:24px 36px;">
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#FFFFFF;">Simporic</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#F5EFE6;margin:0 0 20px;">Did you get a chance to look at the proposal?</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#F5EFE6;line-height:1.7;margin:0 0 16px;">We put together something specific for ${businessName}. If you had any questions come up after reading it, our AI is available right now to walk you through the details at no pressure.</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#F5EFE6;line-height:1.7;margin:0 0 28px;">No sales pitch. Just answers.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#E8A020;border-radius:8px;padding:14px 28px;">
                  <a href="${aceUrl}" style="font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Talk to ACE Right Now</a>
                </td>
              </tr>
            </table>
            <p style="font-family:Arial,sans-serif;font-size:12px;color:#9CA3AF;margin:20px 0 0;">Available 24 hours a day. No hold times. No voicemail.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#060D16;border-top:1px solid #264766;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Simporic &nbsp;&bull;&nbsp; simporic.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function finalNoticeHtml(businessName: string, aceUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1520;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1520;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#162C42;border-radius:12px;border:1px solid #264766;overflow:hidden;">
        <tr>
          <td style="background:#0A1520;padding:24px 36px;">
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#FFFFFF;">Simporic</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#F5EFE6;margin:0 0 20px;">Last note on the ${businessName} proposal</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#F5EFE6;line-height:1.7;margin:0 0 16px;">We are wrapping up our outreach this week and wanted to make sure this did not fall through the cracks. The $${PRICING.standard.setup} setup rate we quoted is what we hold for businesses we reach out to directly. After this week it goes back to standard pricing.</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#F5EFE6;line-height:1.7;margin:0 0 28px;">If the timing is not right, no problem. If you have questions before deciding, ACE can answer them right now.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#E8A020;border-radius:8px;padding:14px 28px;">
                  <a href="${aceUrl}" style="font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Talk to ACE</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#060D16;border-top:1px solid #264766;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Simporic &nbsp;&bull;&nbsp; simporic.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Generic outreach shell for prospecting sequence emails. Body arrives as
// markdown-ish plain text from Claude; render paragraphs + ## headings only.
export function wrapOutreachEmail(bodyMd: string, businessName: string): string {
  const lines = bodyMd.split("\n");
  let html = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      html += `<h2 style="font-family:Georgia,serif;font-size:18px;color:#F5EFE6;margin:28px 0 8px;">${trimmed.slice(3)}</h2>`;
    } else if (trimmed.startsWith("# ")) {
      html += `<h2 style="font-family:Georgia,serif;font-size:20px;color:#F5EFE6;margin:28px 0 8px;">${trimmed.slice(2)}</h2>`;
    } else {
      // inline links: [text](url)
      const withLinks = trimmed.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" style="color:#E8A020;font-weight:600;text-decoration:underline;">$1</a>'
      );
      html += `<p style="font-family:Arial,sans-serif;font-size:14px;color:#F5EFE6;line-height:1.7;margin:0 0 14px;">${withLinks}</p>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1520;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1520;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#162C42;border-radius:12px;border:1px solid #264766;overflow:hidden;">
        <tr>
          <td style="background:#0A1520;padding:24px 36px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,0.2);border-radius:50%;width:32px;height:32px;text-align:center;vertical-align:middle;">
                  <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#FFFFFF;">F10</span>
                </td>
                <td style="padding-left:12px;">
                  <span style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#FFFFFF;">Simporic</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            ${html}
          </td>
        </tr>
        <tr>
          <td style="background:#060D16;border-top:1px solid #264766;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Simporic &nbsp;&bull;&nbsp; simporic.com &nbsp;&bull;&nbsp; Prepared for ${businessName}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Review Engine v1 — customer-facing request + reminder. Sent on behalf of
// the client's business, not Simporic's own outreach voice. One link, every
// customer, no gating branch (Google review-solicitation compliance).
function reviewShell(businessNameRaw: string, heading: string, bodyLines: string[], reviewLink: string): string {
  const businessName = escapeHtml(businessNameRaw);
  const body = bodyLines
    .map(
      (line) =>
        `<p style="font-family:Arial,sans-serif;font-size:14px;color:#F5EFE6;line-height:1.7;margin:0 0 16px;">${line}</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1520;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A1520;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#162C42;border-radius:12px;border:1px solid #264766;overflow:hidden;">
        <tr>
          <td style="background:#0A1520;padding:24px 36px;">
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#FFFFFF;">${businessName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#F5EFE6;margin:0 0 20px;">${heading}</p>
            ${body}
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#E8A020;border-radius:8px;padding:14px 28px;">
                  <a href="${reviewLink}" style="font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Leave a Google Review</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#060D16;border-top:1px solid #264766;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Sent on behalf of ${businessName} &nbsp;&bull;&nbsp; powered by Simporic</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function reviewRequestHtml(businessName: string, customerName: string, reviewLink: string): string {
  const firstName = escapeHtml(customerName.trim().split(/\s+/)[0] || "there");
  const safeBusinessName = escapeHtml(businessName);
  return reviewShell(
    businessName,
    `Quick favor, ${firstName}?`,
    [
      `Thanks for choosing ${safeBusinessName} recently. If you have 30 seconds, a review would mean a lot to us and helps other people find a business they can trust.`,
      `Just tap the button below, it takes you straight to our Google listing.`,
    ],
    reviewLink
  );
}

export function reviewReminderHtml(businessName: string, customerName: string, reviewLink: string): string {
  const firstName = escapeHtml(customerName.trim().split(/\s+/)[0] || "there");
  const safeBusinessName = escapeHtml(businessName);
  return reviewShell(
    businessName,
    `One more ask, ${firstName}`,
    [
      `We reached out a few days ago about leaving ${safeBusinessName} a quick review. No worries if things got busy, here's the link again in case it's easier now.`,
    ],
    reviewLink
  );
}
