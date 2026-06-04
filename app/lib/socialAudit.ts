// app/lib/socialAudit.ts
// Shared core for the Instagram content-strategy audit.
// Used by the interactive SSE route (app/api/social-audit) and the weekly
// cron job (app/api/cron/weekly-social-reports). Keep all scrape/analyze/render
// logic here so both paths stay in sync.
import Anthropic from "@anthropic-ai/sdk";

const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const anthropic = new Anthropic({ apiKey: process.env.F10_ANTHROPIC_KEY });

// ── Handle helpers ────────────────────────────────────────────────────────────

export function cleanHandle(raw: string): string {
  let h = (raw ?? "").trim();
  // Accept a full URL, an @handle, or a bare handle
  const urlMatch = h.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (urlMatch) h = urlMatch[1];
  return h.replace(/^@/, "").replace(/\/+$/, "").trim();
}

// ── Apify Instagram scrape ────────────────────────────────────────────────────

export interface IgPost {
  type?: string;
  productType?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  url?: string;
  hashtags?: string[];
}

export async function scrapeInstagram(handle: string): Promise<IgPost[]> {
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${handle}/`],
        resultsType: "posts",
        resultsLimit: 24,
        addParentData: false,
      }),
    }
  );
  if (!runRes.ok) throw new Error(`Apify run failed to start (${runRes.status})`);
  const { data: run } = await runRes.json();

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/runs/${run.id}?token=${APIFY_TOKEN}`
    );
    const { data: status } = await s.json();
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status.status)) {
      if (status.status !== "SUCCEEDED") throw new Error(`Scrape ${status.status}`);
      const d = await fetch(
        `https://api.apify.com/v2/datasets/${status.defaultDatasetId}/items?token=${APIFY_TOKEN}`
      );
      if (!d.ok) throw new Error("Failed to read scrape results");
      const items = (await d.json()) as Record<string, unknown>[];
      return items
        .filter((i) => i && (i.caption !== undefined || i.url !== undefined))
        .map((i) => ({
          type: i.type as string | undefined,
          productType: i.productType as string | undefined,
          caption: i.caption as string | undefined,
          likesCount: i.likesCount as number | undefined,
          commentsCount: i.commentsCount as number | undefined,
          videoViewCount: i.videoViewCount as number | undefined,
          videoPlayCount: i.videoPlayCount as number | undefined,
          timestamp: i.timestamp as string | undefined,
          url: i.url as string | undefined,
          hashtags: i.hashtags as string[] | undefined,
        }));
    }
  }
  throw new Error("Scrape timed out");
}

// Map a post to a human-readable format label
function formatLabel(p: IgPost): string {
  if (p.productType === "clips") return "Reel";
  if (p.type === "Video") return "Video";
  if (p.type === "Sidecar") return "Carousel";
  return "Image";
}

// Compact the scraped posts into a token-efficient block for Claude
function postsForPrompt(posts: IgPost[]): string {
  return posts
    .map((p, idx) => {
      const cap = (p.caption ?? "").replace(/\s+/g, " ").slice(0, 240);
      const date = p.timestamp ? p.timestamp.slice(0, 10) : "unknown";
      const views = p.videoViewCount ?? p.videoPlayCount;
      return [
        `#${idx + 1} [${formatLabel(p)}] ${date}`,
        `likes=${p.likesCount ?? 0} comments=${p.commentsCount ?? 0}${views ? ` views=${views}` : ""}`,
        `url=${p.url ?? ""}`,
        `caption="${cap}"`,
      ].join("\n");
    })
    .join("\n\n");
}

// ── Claude analysis ────────────────────────────────────────────────────────────

export interface SocialAudit {
  overall_score: number;
  account_summary: string;
  posting_cadence: string;
  top_posts: Array<{
    rank: number;
    hook: string;
    format: string;
    likes: number;
    comments: number;
    date: string;
    url: string;
    why_it_worked: string;
  }>;
  format_performance: Array<{ format: string; verdict: string; note: string }>;
  content_pillars: Array<{ pillar: string; verdict: string; note: string }>;
  winning_hooks: Array<{ example: string; why: string }>;
  underperforming_hooks: Array<{ example: string; why: string }>;
  strategy_recommendations: string[];
}

export async function runSocialAudit(
  businessName: string,
  handle: string,
  posts: IgPost[]
): Promise<SocialAudit> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are a senior content strategist at F10 Strategy. Analyze this Instagram account's recent posts and return a detailed JSON content-performance report — the kind a $5k/mo agency would deliver, but sharper.

Business: ${businessName}
Handle: @${handle}
Posts analyzed: ${posts.length}

RECENT POSTS (most recent first):
${postsForPrompt(posts)}

Return ONLY valid JSON matching this exact structure:
{
  "overall_score": <0-100 integer — content/engagement health>,
  "account_summary": "<2-3 sentence executive summary of how this account is performing and the single biggest lever>",
  "posting_cadence": "<e.g. '14 posts in the last 30 days — consistent' or 'sporadic'>",
  "top_posts": [
    {
      "rank": <1-3>,
      "hook": "<the opening line / hook of the caption, or a short description if no caption>",
      "format": "<Reel|Video|Carousel|Image>",
      "likes": <int>,
      "comments": <int>,
      "date": "<YYYY-MM-DD>",
      "url": "<post url>",
      "why_it_worked": "<1-2 sentences: the concrete reason this post outperformed — hook mechanic, emotion, CTA, specificity>"
    }
  ],
  "format_performance": [
    { "format": "<Reel|Carousel|Image|Video>", "verdict": "<best|strong|weak>", "note": "<short data-backed note>" }
  ],
  "content_pillars": [
    { "pillar": "<theme/topic, e.g. 'income education'>", "verdict": "<best|strong|weak>", "note": "<short note>" }
  ],
  "winning_hooks": [
    { "example": "<a hook that drove engagement>", "why": "<why it worked — emotional, specific, curiosity, transformation>" }
  ],
  "underperforming_hooks": [
    { "example": "<a hook that flopped>", "why": "<why it underperformed — too broad, no proof, no data point>" }
  ],
  "strategy_recommendations": ["<next-week action #1>", "<#2>", "<#3>", "<#4>"]
}

Rules:
- top_posts: exactly the top 3 by engagement (likes + comments). Use real numbers and real urls from the data.
- format_performance: cover every format the account actually uses, ranked.
- content_pillars: infer 3-4 themes from the captions and rank them by how they perform.
- winning_hooks / underperforming_hooks: 2-3 each, quote or paraphrase real captions from the data.
- Be specific and data-backed. Reference actual posts. No generic advice.`,
      },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude returned non-JSON response");
  return JSON.parse(jsonMatch[0]) as SocialAudit;
}

// ── HTML report builder ───────────────────────────────────────────────────────

function scoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function scoreColor(score: number): string {
  if (score >= 75) return "#22C55E";
  if (score >= 55) return "#F59E0B";
  return "#EF4444";
}

function verdictColor(v: string): string {
  const s = v.toLowerCase();
  return s === "best" || s === "strong" ? "#22C55E" : s === "weak" ? "#EF4444" : "#F59E0B";
}

export function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSocialHtml(businessName: string, handle: string, audit: SocialAudit): string {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const grade = scoreGrade(audit.overall_score);
  const overallColor = scoreColor(audit.overall_score);

  const topPostsHtml = audit.top_posts
    .map(
      (p) => `
    <div class="post">
      <div class="post-rank">#${p.rank}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="format-badge">${esc(p.format)}</span>
          <span class="post-meta">${esc(p.date)} · ${(p.likes ?? 0).toLocaleString()} likes · ${(p.comments ?? 0).toLocaleString()} comments</span>
        </div>
        <p class="post-hook">"${esc(p.hook)}"</p>
        <p class="post-why"><strong>Why it worked:</strong> ${esc(p.why_it_worked)}</p>
        ${p.url ? `<a class="post-link" href="${esc(p.url)}">View post →</a>` : ""}
      </div>
    </div>`
    )
    .join("");

  const formatRows = audit.format_performance
    .map(
      (f) => `
    <div class="row">
      <span class="row-verdict" style="color:${verdictColor(f.verdict)}">${esc(f.verdict.toUpperCase())}</span>
      <span class="row-label">${esc(f.format)}</span>
      <span class="row-note">${esc(f.note)}</span>
    </div>`
    )
    .join("");

  const pillarRows = audit.content_pillars
    .map(
      (p) => `
    <div class="row">
      <span class="row-verdict" style="color:${verdictColor(p.verdict)}">${esc(p.verdict.toUpperCase())}</span>
      <span class="row-label">${esc(p.pillar)}</span>
      <span class="row-note">${esc(p.note)}</span>
    </div>`
    )
    .join("");

  const winHooks = audit.winning_hooks
    .map((h) => `<div class="hook win"><p class="hook-ex">"${esc(h.example)}"</p><p class="hook-why">${esc(h.why)}</p></div>`)
    .join("");

  const loseHooks = audit.underperforming_hooks
    .map((h) => `<div class="hook lose"><p class="hook-ex">"${esc(h.example)}"</p><p class="hook-why">${esc(h.why)}</p></div>`)
    .join("");

  const recsHtml = audit.strategy_recommendations.map((r) => `<li>${esc(r)}</li>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Content Strategy Report — ${esc(businessName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Outfit',sans-serif;color:#1C1917;background:#FAFAF9;font-size:14px;line-height:1.7;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cover{background:#0B1928;color:#F4F1EC;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:80px 72px;page-break-after:always}
.brand{font-family:'Outfit',sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#C9A96E;margin-bottom:56px}
.cover-title{font-family:'Cormorant Garamond',serif;font-size:54px;font-weight:600;line-height:1.1;margin-bottom:16px}
.cover-sub{font-size:17px;color:#8B9BAD;margin-bottom:56px}
.divider{width:60px;height:3px;background:#C9A96E;margin-bottom:40px}
.meta{font-size:13px;color:#8B9BAD;line-height:2.2}
.meta strong{color:#F4F1EC}
.overall-score-wrap{display:flex;align-items:center;gap:32px;margin-top:40px;padding:32px;background:rgba(255,255,255,0.05);border-radius:12px;border:1px solid rgba(201,169,110,0.2)}
.score-circle{width:100px;height:100px;border-radius:50%;border:4px solid ${overallColor};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.score-big{font-family:'Cormorant Garamond',serif;font-size:38px;font-weight:700;color:${overallColor};line-height:1}
.score-grade{font-size:13px;color:#8B9BAD;margin-top:4px}
.score-desc{color:#8B9BAD;font-size:14px;line-height:1.6}
.score-desc strong{color:#F4F1EC;display:block;font-family:'Cormorant Garamond',serif;font-size:20px;margin-bottom:6px}
.sec{padding:56px 72px;page-break-inside:avoid}
.dark{background:#0B1928;color:#F4F1EC}
.light{background:#EEF2F7;color:#1C1917}
.white{background:#FAFAF9;color:#1C1917}
.sec-label{font-family:'Outfit',sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#C9A96E;margin-bottom:10px}
.sec-heading{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:600;margin-bottom:28px;line-height:1.2}
.dark .sec-heading{color:#F4F1EC}.light .sec-heading,.white .sec-heading{color:#0B1928}
p{line-height:1.75}
.cadence{font-size:13px;color:#6B7280;margin-bottom:24px;font-style:italic}
.post{display:flex;gap:20px;background:white;border:1px solid #E5E7EB;border-radius:8px;padding:22px 24px;margin-bottom:16px}
.post-rank{font-family:'Cormorant Garamond',serif;font-size:32px;font-weight:700;color:#C9A96E;line-height:1;flex-shrink:0;width:44px}
.post-body{flex:1}
.post-header{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.format-badge{font-size:10px;font-weight:700;letter-spacing:1px;padding:3px 10px;border-radius:20px;background:rgba(201,169,110,0.15);color:#9A7B43;border:1px solid rgba(201,169,110,0.4)}
.post-meta{font-size:12px;color:#9CA3AF}
.post-hook{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:600;color:#0B1928;margin-bottom:8px;line-height:1.4}
.post-why{font-size:13px;color:#6B7280;line-height:1.65;margin-bottom:8px}
.post-why strong{color:#374151}
.post-link{font-size:12px;color:#C9A96E;text-decoration:none}
.row{display:flex;align-items:baseline;gap:14px;padding:12px 0;border-bottom:1px solid #E5E7EB}
.row:last-child{border-bottom:none}
.row-verdict{font-size:10px;font-weight:700;letter-spacing:1px;width:64px;flex-shrink:0}
.row-label{font-weight:600;font-size:14px;color:#0B1928;width:160px;flex-shrink:0}
.row-note{font-size:13px;color:#6B7280;flex:1}
.hooks-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.hook{border-radius:8px;padding:18px 20px;border:1px solid #E5E7EB;background:white}
.hook.win{border-left:3px solid #22C55E}
.hook.lose{border-left:3px solid #EF4444}
.hook-ex{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:600;color:#0B1928;margin-bottom:8px;line-height:1.4}
.hook-why{font-size:12px;color:#6B7280;line-height:1.6}
.action-list{list-style:none}
.action-list li{padding:12px 16px;border-radius:6px;font-size:13px;margin-bottom:8px;border-left:3px solid #C9A96E;background:white;color:#374151}
.footer{background:#0B1928;color:#8B9BAD;padding:24px 72px;display:flex;justify-content:space-between;align-items:center;font-size:12px}
.footer strong{color:#F4F1EC}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cover{page-break-after:always}}
</style></head><body>

<div class="cover">
  <div class="brand">F10 Strategy</div>
  <div class="cover-title">Content Strategy Report<br>${esc(businessName)}</div>
  <div class="cover-sub">Instagram Performance &amp; Content Strategy Analysis</div>
  <div class="divider"></div>
  <div class="meta">
    <strong>Account:</strong> @${esc(handle)}<br>
    <strong>Prepared by:</strong> F10 Strategy<br>
    <strong>Date:</strong> ${date}
  </div>
  <div class="overall-score-wrap">
    <div class="score-circle">
      <div class="score-big">${audit.overall_score}</div>
      <div class="score-grade">Grade ${grade}</div>
    </div>
    <div class="score-desc">
      <strong>Content Health Score</strong>
      ${esc(audit.account_summary)}
    </div>
  </div>
</div>

<div class="sec white">
  <div class="sec-label">01 — Top Performers</div>
  <div class="sec-heading">What's Working Right Now</div>
  <p class="cadence">${esc(audit.posting_cadence)}</p>
  ${topPostsHtml}
</div>

<div class="sec light">
  <div class="sec-label">02 — Format Performance</div>
  <div class="sec-heading">Which Formats Win</div>
  ${formatRows}
</div>

<div class="sec white">
  <div class="sec-label">03 — Content Pillars</div>
  <div class="sec-heading">What Your Audience Responds To</div>
  ${pillarRows}
</div>

<div class="sec light">
  <div class="sec-label">04 — Hook Analysis</div>
  <div class="sec-heading">Hooks That Drove Engagement</div>
  <div class="hooks-grid">${winHooks}</div>
  <div class="sec-heading" style="font-size:24px;margin-top:36px;margin-bottom:20px">Hooks That Underperformed</div>
  <div class="hooks-grid">${loseHooks}</div>
</div>

<div class="sec dark">
  <div class="sec-label">05 — Next Week's Playbook</div>
  <div class="sec-heading">Strategy Recommendations</div>
  <ul class="action-list">${recsHtml}</ul>
</div>

<div class="footer">
  <div><strong>Efton Geary</strong> &nbsp;|&nbsp; F10 Strategy · f10strategy.com</div>
  <div>efton@f10strategy.com &nbsp;|&nbsp; ${date}</div>
</div>

</body></html>`;
}

// ── One-shot convenience (used by the weekly cron job) ─────────────────────────

export interface SocialReport {
  audit: SocialAudit;
  html: string;
  score: number;
  postCount: number;
}

export async function generateSocialReport(
  businessName: string,
  rawHandle: string
): Promise<SocialReport> {
  const handle = cleanHandle(rawHandle);
  if (!handle) throw new Error("No Instagram handle provided");

  const posts = await scrapeInstagram(handle);
  if (posts.length === 0) {
    throw new Error("No public posts found (account may be private, empty, or wrong handle)");
  }

  const audit = await runSocialAudit(businessName, handle, posts);
  const html = buildSocialHtml(businessName, handle, audit);
  return { audit, html, score: audit.overall_score, postCount: posts.length };
}
