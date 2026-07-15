// app/lib/weeklyReportEmail.ts
// Email-friendly summary of a weekly content report. The full branded report
// is attached as an HTML file; this is the at-a-glance body that lands in the
// client's inbox. Uses table layout for email-client compatibility.
import type { SocialAudit } from "@/app/lib/socialAudit";

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scoreColor(score: number): string {
  if (score >= 75) return "#16A34A";
  if (score >= 55) return "#D97706";
  return "#DC2626";
}

export function weeklyReportEmailHtml(businessName: string, handle: string, audit: SocialAudit): string {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const color = scoreColor(audit.overall_score);

  const topPosts = audit.top_posts
    .slice(0, 3)
    .map(
      (p) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #EEF2F7;">
          <p style="font-family:Georgia,serif;font-size:15px;font-weight:600;color:#1C1917;margin:0 0 4px;">#${p.rank} · ${esc(p.format)} <span style="font-family:Arial,sans-serif;font-size:12px;font-weight:400;color:#9CA3AF;">${(p.likes ?? 0).toLocaleString()} likes · ${(p.comments ?? 0).toLocaleString()} comments</span></p>
          <p style="font-family:Arial,sans-serif;font-size:13px;color:#4B5563;line-height:1.6;margin:0 0 4px;">"${esc(p.hook)}"</p>
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#6B7280;line-height:1.6;margin:0;"><strong style="color:#374151;">Why it worked:</strong> ${esc(p.why_it_worked)}</p>
        </td>
      </tr>`
    )
    .join("");

  const recs = audit.strategy_recommendations
    .map(
      (r) => `<li style="font-family:Arial,sans-serif;font-size:13px;color:#4B5563;line-height:1.7;margin:0 0 6px;">${esc(r)}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#0B1928;padding:28px 36px;">
            <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C9A96E;margin:0 0 8px;">F10 Strategy</p>
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#FFFFFF;margin:0;">Your Weekly Content Report</p>
            <p style="font-family:Arial,sans-serif;font-size:13px;color:#8B9BAD;margin:6px 0 0;">${esc(businessName)} · @${esc(handle)} · ${date}</p>
          </td>
        </tr>

        <!-- Score -->
        <tr>
          <td style="padding:28px 36px 8px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <span style="font-family:Georgia,serif;font-size:40px;font-weight:700;color:${color};">${audit.overall_score}</span>
                  <span style="font-family:Arial,sans-serif;font-size:13px;color:#9CA3AF;">/100</span>
                </td>
                <td style="padding-left:18px;vertical-align:middle;">
                  <p style="font-family:Arial,sans-serif;font-size:13px;color:#4B5563;line-height:1.6;margin:0;">${esc(audit.account_summary)}</p>
                </td>
              </tr>
            </table>
            <p style="font-family:Arial,sans-serif;font-size:12px;color:#9CA3AF;font-style:italic;margin:12px 0 0;">${esc(audit.posting_cadence)}</p>
          </td>
        </tr>

        <!-- Top posts -->
        <tr>
          <td style="padding:20px 36px 8px;">
            <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A96E;margin:0 0 6px;">Top Performers</p>
            <table width="100%" cellpadding="0" cellspacing="0">${topPosts}</table>
          </td>
        </tr>

        <!-- Recommendations -->
        <tr>
          <td style="padding:20px 36px 28px;">
            <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A96E;margin:0 0 8px;">Next Week's Playbook</p>
            <ul style="margin:0;padding-left:18px;">${recs}</ul>
          </td>
        </tr>

        <!-- Attachment note -->
        <tr>
          <td style="padding:0 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;border-radius:8px;">
              <tr><td style="padding:16px 20px;">
                <p style="font-family:Arial,sans-serif;font-size:13px;color:#4B5563;line-height:1.6;margin:0;">The full report — format performance, content pillars, and hook analysis — is attached as <strong>content-report.html</strong>. Open it in any browser.</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0B1928;border-top:1px solid #1C2B3A;padding:20px 36px;text-align:center;">
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#8B9BAD;margin:0;">F10 Strategy &nbsp;&bull;&nbsp; f10strategy.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
