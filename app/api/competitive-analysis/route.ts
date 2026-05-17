import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const anthropic = new Anthropic({ apiKey: process.env.F10_ANTHROPIC_KEY });

// ── Brand definitions ──────────────────────────────────────────────────────────

const BRANDS: Record<string, Record<string, string>> = {
  f10_strategy: {
    name: "F10 Strategy",
    contact: "efton@f10strategy.com",
    website: "f10strategy.com",
    fontUrl: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap",
    fontHeading: "'Cormorant Garamond', serif",
    fontBody: "'Outfit', sans-serif",
    bgDark: "#0D1B2A", bgDark2: "#1A2B3C", bgCard: "#112034",
    accent: "#E8A020", accentMuted: "#C8880E",
    textLight: "#F5F5F0", textMuted: "#A8B8C8",
    bgWhite: "#FAFAF9", bgLight: "#F0F4F8", textDark: "#1C1917",
  },
  aos: {
    name: "AI Operator Systems",
    contact: "efton@aioperatorsystems.com",
    website: "aioperatorsystems.com",
    fontUrl: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap",
    fontHeading: "'Instrument Serif', serif",
    fontBody: "'DM Sans', sans-serif",
    bgDark: "#0B0B0C", bgDark2: "#1C1C22", bgCard: "#111214",
    accent: "#C8A96B", accentMuted: "#A88B50",
    textLight: "#FDFCFB", textMuted: "#9A9490",
    bgWhite: "#FDFCFB", bgLight: "#F7F5F2", textDark: "#1C1917",
  },
};

// ── Apify helpers ──────────────────────────────────────────────────────────────

async function runApifyActor(actorId: string, input: object): Promise<unknown[]> {
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
  );
  if (!runRes.ok) return [];
  const { data: run } = await runRes.json();
  const runId: string = run.id;

  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${APIFY_TOKEN}`
    );
    const { data: status } = await statusRes.json();
    if (["SUCCEEDED", "FAILED", "ABORTED"].includes(status.status)) {
      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${status.defaultDatasetId}/items?token=${APIFY_TOKEN}`
      );
      return itemsRes.ok ? itemsRes.json() : [];
    }
  }
  return [];
}

async function scrapeGoogleMaps(name: string, market: string) {
  const items = await runApifyActor("nwua9Gu5YrADL7ZDj", {
    searchStringsArray: [`${name} ${market}`],
    maxCrawledPlacesPerSearch: 1,
    language: "en",
    maxReviews: 0,
  }) as Record<string, unknown>[];
  if (!items.length) return { name, rating: null, review_count: null, address: null, website: null };
  const p = items[0];
  return {
    name: (p.title as string) ?? name,
    rating: p.totalScore ?? null,
    review_count: p.reviewsCount ?? null,
    address: p.address ?? null,
    website: p.website ?? null,
  };
}

async function scrapeWebsite(url: string | null): Promise<string> {
  if (!url) return "";
  try {
    const items = await runApifyActor("apify~website-content-crawler", {
      startUrls: [{ url }],
      maxCrawlPages: 3,
      crawlerType: "cheerio",
      maxCrawlDepth: 1,
    }) as Record<string, unknown>[];
    return items.map((i) => i.text ?? "").join(" ").slice(0, 5000);
  } catch {
    return "";
  }
}

// ── Claude synthesis ───────────────────────────────────────────────────────────

async function synthesize(
  clientName: string, industry: string, marketDisplay: string,
  brandName: string, competitorsRaw: object[]
) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: `You are a senior market intelligence analyst at ${brandName}.

Write a competitive analysis for ${clientName}, a ${industry} business in ${marketDisplay}.

Raw research data:
${JSON.stringify(competitorsRaw, null, 2)}

Return ONLY valid JSON with these keys (no markdown):
{
  "exec_summary": "2 paragraphs: market conditions, then ${clientName} opportunity",
  "market_overview": "1 paragraph on demand drivers and timing",
  "competitors": [{
    "name": "",
    "rating": 0,
    "review_count": 0,
    "address": "",
    "services_summary": "2-3 sentences on what they offer",
    "has_pricing": false,
    "has_online_booking": false,
    "has_financing": false,
    "has_chat": false,
    "automation_level": "Low",
    "aos_gap_score": "High",
    "profile_narrative": "3-4 sentences on digital presence and gaps"
  }],
  "gaps": [{"gap": "", "system": ""}],
  "next_steps": "2-3 sentences on recommended next steps"
}`
    }]
  });
  const raw = (msg.content[0] as { text: string }).text.trim()
    .replace(/^```json?\n?/, "").replace(/```$/, "");
  return JSON.parse(raw);
}

// ── HTML builder ───────────────────────────────────────────────────────────────

function buildHtml(data: Record<string, unknown>, brandKey: string): string {
  const b = BRANDS[brandKey] ?? BRANDS.f10_strategy;
  const competitors = data.competitors as Record<string, unknown>[];
  const gaps = data.gaps as Record<string, string>[];
  const date = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const yn = (v: unknown) => v ? "Yes" : "No";
  const lvl = (v: unknown) => ({ Low: "score-low", Medium: "score-med", High: "score-high" }[(v as string)] ?? "");

  const compsHtml = competitors.map((c) => {
    const rating = c.rating as number | null;
    const stars = rating ? "★".repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? "½" : "") : "N/A";
    return `<div class="card">
      <div class="ch"><div><div class="cn">${c.name}</div><div class="cm">${c.address ?? ""}</div></div>
      <div class="cr"><span class="st">${stars}</span> <span class="rn">${rating ?? "N/A"}</span> <span class="rc">(${c.review_count ?? "N/A"} reviews)</span></div></div>
      <div class="cb"><p>${c.services_summary}</p>
      <div class="tags">
        <span class="tag ${c.has_pricing ? "ty" : "tn"}">Pricing: ${yn(c.has_pricing)}</span>
        <span class="tag ${c.has_online_booking ? "ty" : "tn"}">Booking: ${yn(c.has_online_booking)}</span>
        <span class="tag ${c.has_financing ? "ty" : "tn"}">Financing: ${yn(c.has_financing)}</span>
        <span class="tag ${c.has_chat ? "ty" : "tn"}">Chat: ${yn(c.has_chat)}</span>
      </div>
      <p class="pn">${c.profile_narrative}</p>
      <div class="gs">Automation: <span class="${lvl(c.automation_level)} badge">${c.automation_level}</span> &nbsp; Gap: <span class="${lvl(c.aos_gap_score)} badge">${c.aos_gap_score}</span></div>
      </div></div>`;
  }).join("");

  const matrixRows = competitors.map((c) => `<tr>
    <td class="bold">${c.name}</td>
    <td class="center">${c.rating ?? "N/A"}</td>
    <td class="center ${c.has_pricing ? "yes" : "no"}">${yn(c.has_pricing)}</td>
    <td class="center ${c.has_online_booking ? "yes" : "no"}">${yn(c.has_online_booking)}</td>
    <td class="center ${c.has_financing ? "yes" : "no"}">${yn(c.has_financing)}</td>
    <td class="center ${c.has_chat ? "yes" : "no"}">${yn(c.has_chat)}</td>
    <td class="center"><span class="${lvl(c.automation_level)} badge-sm">${c.automation_level}</span></td>
  </tr>`).join("");

  const gapRows = gaps.map((g) => `<tr><td class="gd">${g.gap}</td><td class="sd">${g.system}</td></tr>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Competitive Analysis — ${data.client_name}</title>
<link href="${b.fontUrl}" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:${b.fontBody};color:${b.textDark};background:${b.bgWhite};font-size:14px;line-height:1.7}
.cover{background:${b.bgDark};color:${b.textLight};min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:80px 72px;page-break-after:always}
.brand{font-family:${b.fontHeading};font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${b.accent};margin-bottom:60px}
.title{font-family:${b.fontHeading};font-size:52px;font-weight:600;line-height:1.15;margin-bottom:20px}
.sub{font-size:18px;color:${b.textMuted};margin-bottom:60px}
.div{width:60px;height:3px;background:${b.accent};margin-bottom:40px}
.meta{font-size:13px;color:${b.textMuted};line-height:2}.meta strong{color:${b.textLight}}
.sec{padding:64px 72px;page-break-inside:avoid}
.dark{background:${b.bgDark2};color:${b.textLight}}
.light{background:${b.bgLight};color:${b.textDark}}
.white{background:${b.bgWhite};color:${b.textDark}}
.label{font-family:${b.fontHeading};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${b.accent};margin-bottom:12px}
.heading{font-family:${b.fontHeading};font-size:34px;font-weight:600;margin-bottom:32px;line-height:1.2}
.dark .heading{color:${b.textLight}}.light .heading,.white .heading{color:${b.bgDark}}
p{margin-bottom:16px}
.card{background:white;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:24px;overflow:hidden}
.ch{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 24px;border-bottom:1px solid #E5E7EB;background:${b.bgLight}}
.cn{font-family:${b.fontHeading};font-size:20px;font-weight:600;color:${b.bgDark}}
.cm{font-size:12px;color:#6B7280;margin-top:4px}
.cr{text-align:right}
.st{color:${b.accent};font-size:14px}.rn{font-size:18px;font-weight:600;color:${b.bgDark};margin-left:6px}.rc{font-size:12px;color:#6B7280}
.cb{padding:20px 24px}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.tag{font-size:11px;padding:3px 10px;border-radius:20px;font-weight:500}
.ty{background:#DCFCE7;color:#166534}.tn{background:#FEF2F2;color:#991B1B}
.pn{color:#4B5563;font-size:13px;margin-bottom:12px}
.gs{font-size:12px;color:#6B7280}
.badge{display:inline-block;font-size:11px;padding:2px 10px;border-radius:20px;font-weight:600}
.badge-sm{display:inline-block;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:600}
.score-low{background:#DCFCE7;color:#166534}.score-med{background:#FEF9C3;color:#854D0E}.score-high{background:#FEE2E2;color:#991B1B}
.mt{width:100%;border-collapse:collapse;font-size:13px}
.mt th{background:${b.bgDark};color:${b.textLight};padding:10px 14px;text-align:center;font-family:${b.fontHeading};font-size:12px;letter-spacing:1px;text-transform:uppercase}
.mt th:first-child{text-align:left}
.mt td{padding:10px 14px;border-bottom:1px solid #E5E7EB}
.mt tr:last-child td{border-bottom:none}
.mt tr:nth-child(even) td{background:${b.bgLight}}
.bold{font-weight:600;color:${b.bgDark}}.center{text-align:center}.yes{color:#166534;font-weight:600}.no{color:#991B1B}
.gt{width:100%;border-collapse:collapse;font-size:13px}
.gt th{background:${b.accent};color:white;padding:10px 16px;text-align:left;font-family:${b.fontHeading};font-size:12px;letter-spacing:1px;text-transform:uppercase}
.gt td{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.1);color:${b.textLight}}
.gt tr:last-child td{border-bottom:none}
.gt tr:nth-child(even) td{background:rgba(255,255,255,0.04)}
.gd{font-weight:500}.sd{color:${b.accent}}
.nsbox{background:rgba(255,255,255,0.06);border-left:4px solid ${b.accent};padding:24px 28px;border-radius:4px;margin-top:24px}
.bar{background:${b.bgDark};color:${b.textMuted};padding:24px 72px;display:flex;justify-content:space-between;align-items:center;font-size:12px}
.bar strong{color:${b.textLight}}
</style></head><body>
<div class="cover">
  <div class="brand">${b.name}</div>
  <div class="title">${data.industry} Market<br>Competitive Analysis</div>
  <div class="sub">A Market Intelligence Report for ${data.client_name}</div>
  <div class="div"></div>
  <div class="meta"><strong>Market:</strong> ${data.market_display}<br><strong>Prepared by:</strong> ${b.name}<br><strong>Date:</strong> ${date}</div>
</div>
<div class="sec dark">
  <div class="label">01 — Executive Summary</div>
  <div class="heading">Where ${data.client_name} Stands Today</div>
  <p>${(data.exec_summary as string).replace(/\n/g, "</p><p>")}</p>
</div>
<div class="sec light">
  <div class="label">02 — Market Overview</div>
  <div class="heading">The ${data.market_display} Opportunity</div>
  <p>${data.market_overview}</p>
</div>
<div class="sec white">
  <div class="label">03 — Competitor Profiles</div>
  <div class="heading">Who You Are Up Against</div>
  ${compsHtml}
</div>
<div class="sec light">
  <div class="label">04 — Scoring Matrix</div>
  <div class="heading">Capability Comparison</div>
  <table class="mt"><thead><tr>
    <th>Competitor</th><th>Rating</th><th>Pricing</th><th>Booking</th><th>Financing</th><th>Chat</th><th>Automation</th>
  </tr></thead><tbody>${matrixRows}</tbody></table>
</div>
<div class="sec dark">
  <div class="label">05 — Opportunity Map</div>
  <div class="heading">Where Automation Closes the Gap</div>
  <table class="gt"><thead><tr><th style="width:50%">Gap Identified</th><th style="width:50%">System That Closes It</th></tr></thead>
  <tbody>${gapRows}</tbody></table>
</div>
<div class="sec dark" style="padding-top:0">
  <div class="label">06 — Next Steps</div>
  <div class="heading">The Path Forward</div>
  <div class="nsbox"><p>${data.next_steps}</p></div>
</div>
<div class="bar">
  <div><strong>Efton Geary</strong> &nbsp;|&nbsp; ${b.name} &middot; ${b.website}</div>
  <div>${b.contact} &nbsp;|&nbsp; ${date}</div>
</div>
</body></html>`;
}

// ── SSE handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_name, industry, market, market_display, competitors, brand } = body;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "log", msg: `Scraping ${competitors.length} competitors in parallel...` });

        const competitorsRaw = await Promise.all(
          competitors.map(async (name: string) => {
            send({ type: "log", msg: `Scraping: ${name}` });
            const maps = await scrapeGoogleMaps(name, market);
            const website = await scrapeWebsite(maps.website as string | null);
            return { ...maps, website_text: website };
          })
        );

        send({ type: "log", msg: "Synthesizing with Claude..." });
        const synthesis = await synthesize(
          client_name, industry, market_display || market,
          BRANDS[brand]?.name ?? "F10 Strategy", competitorsRaw
        );

        send({ type: "log", msg: "Building report..." });
        const html = buildHtml({
          client_name, industry,
          market_display: market_display || market,
          ...synthesis,
        }, brand);

        send({ type: "done", html });
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
