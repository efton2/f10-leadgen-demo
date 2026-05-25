import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const anthropic = new Anthropic({ apiKey: process.env.F10_ANTHROPIC_KEY });

// ── URL helpers ───────────────────────────────────────────────────────────────

function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    // Strip UTM and tracking params
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content",
     "fbclid","gclid","msclkid","ref","source","mc_cid","mc_eid"].forEach(p => u.searchParams.delete(p));
    return u.origin + u.pathname.replace(/\/$/, "") || u.origin;
  } catch {
    return raw;
  }
}

function extractInternalLinks(html: string, origin: string): string[] {
  const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map(m => m[1]);
  const priority = ["services","treatment","about","pricing","price","contact","menu","procedures","specials","offer"];
  const seen = new Set<string>();
  const links: string[] = [];

  for (const href of hrefs) {
    try {
      const url = new URL(href, origin);
      if (url.origin !== origin) continue;
      const path = url.pathname.toLowerCase();
      if (path === "/" || path === "") continue;
      const key = url.origin + url.pathname;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push(key);
    } catch { /* skip */ }
  }

  // Sort: priority paths first, then rest
  links.sort((a, b) => {
    const aScore = priority.findIndex(k => a.toLowerCase().includes(k));
    const bScore = priority.findIndex(k => b.toLowerCase().includes(k));
    const aP = aScore === -1 ? 99 : aScore;
    const bP = bScore === -1 ? 99 : bScore;
    return aP - bP;
  });

  return links.slice(0, 5);
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 3000);
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── Apify fallback ────────────────────────────────────────────────────────────

async function apifyFallback(url: string): Promise<string> {
  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/apify~website-content-crawler/runs?token=${APIFY_TOKEN}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUrls: [{ url }], maxCrawlPages: 5, crawlerType: "cheerio", maxCrawlDepth: 1 }) }
    );
    if (!runRes.ok) return "";
    const { data: run } = await runRes.json();
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const s = await fetch(`https://api.apify.com/v2/acts/apify~website-content-crawler/runs/${run.id}?token=${APIFY_TOKEN}`);
      const { data: status } = await s.json();
      if (["SUCCEEDED","FAILED","ABORTED"].includes(status.status)) {
        const d = await fetch(`https://api.apify.com/v2/datasets/${status.defaultDatasetId}/items?token=${APIFY_TOKEN}`);
        if (!d.ok) return "";
        const items = await d.json() as Record<string,unknown>[];
        return items.map(i => `[PAGE: ${i.url}]\n${i.text ?? ""}`).join("\n\n").slice(0, 8000);
      }
    }
  } catch { /* fall through */ }
  return "";
}

// ── Hybrid scraper ────────────────────────────────────────────────────────────

async function scrapeWebsite(rawUrl: string): Promise<{ content: string; method: string }> {
  const base = cleanUrl(rawUrl);
  const origin = new URL(base.startsWith("http") ? base : `https://${base}`).origin;

  // 1. Fetch homepage directly
  const homepageHtml = await fetchPage(base.startsWith("http") ? base : `https://${base}`);

  if (!homepageHtml) {
    // Direct fetch blocked — fall back to Apify
    const content = await apifyFallback(base);
    return { content, method: "apify-fallback" };
  }

  const homepageText = `[PAGE: ${base}]\n${htmlToText(homepageHtml)}`;

  // 2. Extract internal links from homepage, fetch priority pages
  const internalLinks = extractInternalLinks(homepageHtml, origin);
  const subpageTexts: string[] = [];

  await Promise.all(
    internalLinks.slice(0, 4).map(async (link) => {
      const html = await fetchPage(link);
      if (html) subpageTexts.push(`[PAGE: ${link}]\n${htmlToText(html)}`);
    })
  );

  const all = [homepageText, ...subpageTexts].join("\n\n");
  return {
    content: all.slice(0, 10000),
    method: `direct (${1 + subpageTexts.length} pages)`,
  };
}

// ── Claude audit ─────────────────────────────────────────────────────────────

interface AuditResult {
  overall_score: number;
  scores: {
    content_messaging: number;
    conversion: number;
    seo: number;
    technical: number;
    trust_social_proof: number;
  };
  executive_summary: string;
  findings: Array<{ severity: "critical" | "high" | "medium"; title: string; detail: string }>;
  quick_wins: string[];
  month_plan: string[];
  competitive_edge: string;
}

async function runAudit(businessName: string, website: string, websiteContent: string): Promise<AuditResult> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `You are a senior marketing strategist at F10 Strategy. Audit this business website and return a detailed JSON assessment.

Business: ${businessName}
Website: ${website}

Website content scraped across up to 5 pages:
${websiteContent || "(content unavailable — base assessment on URL and business name)"}

Return ONLY valid JSON matching this exact structure:
{
  "overall_score": <0-100 integer>,
  "scores": {
    "content_messaging": <0-100>,
    "conversion": <0-100>,
    "seo": <0-100>,
    "technical": <0-100>,
    "trust_social_proof": <0-100>
  },
  "executive_summary": "<2-3 sentence summary of the site's marketing health>",
  "findings": [
    {
      "severity": "critical|high|medium",
      "title": "<short finding title>",
      "detail": "<1-2 sentence explanation of the problem and its impact>"
    }
  ],
  "quick_wins": ["<actionable fix #1>", "<actionable fix #2>", "<actionable fix #3>", "<actionable fix #4>"],
  "month_plan": ["<30-day action #1>", "<30-day action #2>", "<30-day action #3>"],
  "competitive_edge": "<1-2 sentences on the single strongest opportunity this business has to stand out>"
}

Scoring guide:
- content_messaging: clarity of value prop, headline quality, storytelling, benefit focus
- conversion: CTA strength, form presence, friction points, booking/contact flow
- seo: meta tags, heading structure, keyword presence, schema markup signals
- technical: mobile signals, page speed signals, SSL, broken links, site structure
- trust_social_proof: reviews, testimonials, certifications, social proof elements

Be specific and actionable. Reference actual content from their site in findings. Return 3-6 findings total, prioritized by severity.`,
    }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude returned non-JSON response");
  return JSON.parse(jsonMatch[0]) as AuditResult;
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

function severityColor(s: string): string {
  return s === "critical" ? "#EF4444" : s === "high" ? "#F59E0B" : "#3B82F6";
}

function buildAuditHtml(businessName: string, website: string, audit: AuditResult): string {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const grade = scoreGrade(audit.overall_score);
  const overallColor = scoreColor(audit.overall_score);

  const scoreRows = [
    ["Content & Messaging", audit.scores.content_messaging],
    ["Conversion Optimization", audit.scores.conversion],
    ["SEO & Discoverability", audit.scores.seo],
    ["Technical Presence", audit.scores.technical],
    ["Trust & Social Proof", audit.scores.trust_social_proof],
  ].map(([label, score]) => `
    <div class="score-row">
      <div class="score-label">${label}</div>
      <div class="score-bar-wrap">
        <div class="score-bar" style="width:${score}%;background:${scoreColor(score as number)}"></div>
      </div>
      <div class="score-num" style="color:${scoreColor(score as number)}">${score}</div>
    </div>`).join("");

  const findingsHtml = audit.findings.map((f) => `
    <div class="finding">
      <div class="finding-header">
        <span class="severity-badge" style="background:${severityColor(f.severity)}20;color:${severityColor(f.severity)};border:1px solid ${severityColor(f.severity)}40">${f.severity.toUpperCase()}</span>
        <span class="finding-title">${f.title}</span>
      </div>
      <p class="finding-detail">${f.detail}</p>
    </div>`).join("");

  const quickWinsHtml = audit.quick_wins.map((w) => `<li>${w}</li>`).join("");
  const monthPlanHtml = audit.month_plan.map((a) => `<li>${a}</li>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Marketing Audit — ${businessName}</title>
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
p{margin-bottom:16px;line-height:1.75}
.score-row{display:flex;align-items:center;gap:16px;margin-bottom:14px}
.score-label{font-size:13px;color:#4B5563;width:180px;flex-shrink:0}
.score-bar-wrap{flex:1;height:8px;background:#E5E7EB;border-radius:4px;overflow:hidden}
.score-bar{height:100%;border-radius:4px;transition:width 0.3s}
.score-num{font-weight:600;font-size:14px;width:32px;text-align:right;flex-shrink:0}
.finding{background:white;border:1px solid #E5E7EB;border-radius:8px;padding:20px 24px;margin-bottom:16px}
.finding-header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.severity-badge{font-size:10px;font-weight:700;letter-spacing:1px;padding:3px 10px;border-radius:20px}
.finding-title{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:600;color:#0B1928}
.finding-detail{font-size:13px;color:#6B7280;line-height:1.65;margin:0}
.action-list{list-style:none;space-y:10px}
.action-list li{padding:12px 16px;border-radius:6px;font-size:13px;margin-bottom:8px;border-left:3px solid #C9A96E;background:white;color:#374151}
.edge-box{background:rgba(201,169,110,0.1);border:1px solid rgba(201,169,110,0.3);border-radius:8px;padding:24px 28px;margin-top:8px}
.edge-box p{color:#F4F1EC;margin:0;font-size:15px;line-height:1.7}
.footer{background:#0B1928;color:#8B9BAD;padding:24px 72px;display:flex;justify-content:space-between;align-items:center;font-size:12px}
.footer strong{color:#F4F1EC}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cover{page-break-after:always}}
</style></head><body>

<div class="cover">
  <div class="brand">F10 Strategy</div>
  <div class="cover-title">Marketing Audit<br>${businessName}</div>
  <div class="cover-sub">Website Performance &amp; Opportunity Report</div>
  <div class="divider"></div>
  <div class="meta">
    <strong>Website:</strong> ${website.replace(/^https?:\/\//, "").replace(/\/$/, "")}<br>
    <strong>Prepared by:</strong> F10 Strategy<br>
    <strong>Date:</strong> ${date}
  </div>
  <div class="overall-score-wrap">
    <div class="score-circle">
      <div class="score-big">${audit.overall_score}</div>
      <div class="score-grade">Grade ${grade}</div>
    </div>
    <div class="score-desc">
      <strong>Overall Marketing Score</strong>
      ${audit.executive_summary}
    </div>
  </div>
</div>

<div class="sec light">
  <div class="sec-label">01 — Score Breakdown</div>
  <div class="sec-heading">Where You Stand</div>
  ${scoreRows}
</div>

<div class="sec white">
  <div class="sec-label">02 — Key Findings</div>
  <div class="sec-heading">What Needs Attention</div>
  ${findingsHtml}
</div>

<div class="sec light">
  <div class="sec-label">03 — Action Plan</div>
  <div class="sec-heading">Quick Wins (This Week)</div>
  <ul class="action-list">${quickWinsHtml}</ul>
</div>

<div class="sec white">
  <div class="sec-label">04 — 30-Day Roadmap</div>
  <div class="sec-heading">Next Steps</div>
  <ul class="action-list">${monthPlanHtml}</ul>
</div>

<div class="sec dark">
  <div class="sec-label">05 — Competitive Edge</div>
  <div class="sec-heading">Your Biggest Opportunity</div>
  <div class="edge-box"><p>${audit.competitive_edge}</p></div>
</div>

<div class="footer">
  <div><strong>Efton Geary</strong> &nbsp;|&nbsp; F10 Strategy · f10strategy.com</div>
  <div>efton@f10strategy.com &nbsp;|&nbsp; ${date}</div>
</div>

</body></html>`;
}

// ── SSE handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { website, business_name } = body as { website: string; business_name: string };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "step", step: "fetch", status: "active" });
        send({ type: "log", msg: `Fetching ${cleanUrl(website)}...` });

        const { content: websiteContent, method: scrapeMethod } = await scrapeWebsite(website);

        send({ type: "step", step: "fetch", status: "done" });
        send({ type: "log", msg: `Scraped via ${scrapeMethod}` });
        send({ type: "step", step: "analyze", status: "active" });
        send({ type: "log", msg: "Running AI analysis across 5 dimensions..." });

        const audit = await runAudit(business_name, cleanUrl(website), websiteContent);

        send({ type: "step", step: "analyze", status: "done" });
        send({ type: "step", step: "score", status: "active" });
        send({ type: "log", msg: "Scoring and identifying findings..." });

        await new Promise((r) => setTimeout(r, 500));

        send({ type: "step", step: "score", status: "done" });
        send({ type: "step", step: "build", status: "active" });
        send({ type: "log", msg: "Building PDF report..." });

        const html = buildAuditHtml(business_name, cleanUrl(website), audit);

        send({ type: "step", step: "build", status: "done" });
        send({ type: "done", html, score: audit.overall_score });
      } catch (err) {
        send({ type: "error", msg: String(err) });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
