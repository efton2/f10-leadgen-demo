// Shared Simporic email templates. Extracted from app/api/send-proposal/route.ts
// so both the manual proposal flow and the prospecting engine use one shell.

export function proposalToHtml(proposal: string, businessName: string): string {
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
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">
        <tr>
          <td style="background:#4A6FA5;padding:24px 36px;">
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#FFFFFF;">Simporic</span>
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
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">
        <tr>
          <td style="background:#4A6FA5;padding:24px 36px;">
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#FFFFFF;">Simporic</span>
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
      html += `<h2 style="font-family:Georgia,serif;font-size:18px;color:#1C1917;margin:28px 0 8px;">${trimmed.slice(3)}</h2>`;
    } else if (trimmed.startsWith("# ")) {
      html += `<h2 style="font-family:Georgia,serif;font-size:20px;color:#1C1917;margin:28px 0 8px;">${trimmed.slice(2)}</h2>`;
    } else {
      // inline links: [text](url)
      const withLinks = trimmed.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" style="color:#4A6FA5;font-weight:600;text-decoration:underline;">$1</a>'
      );
      html += `<p style="font-family:Arial,sans-serif;font-size:14px;color:#4B5563;line-height:1.7;margin:0 0 14px;">${withLinks}</p>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">
        <tr>
          <td style="background:#4A6FA5;padding:24px 36px;">
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
          <td style="background:#F7F9FC;border-top:1px solid #E5E0D8;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">Simporic &nbsp;&bull;&nbsp; simporic.com &nbsp;&bull;&nbsp; Prepared for ${businessName}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
