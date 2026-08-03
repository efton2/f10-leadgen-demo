import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const anthropic = new Anthropic({ apiKey: process.env.F10_ANTHROPIC_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

// ── Apify ──────────────────────────────────────────────────────────────────────

async function scrapeInstagram(handle: string): Promise<InstagramPost[]> {
  const cleanHandle = handle.replace(/^@/, "").trim();
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${cleanHandle}/`],
        resultsLimit: 24,
        addParentData: false,
      }),
    }
  );
  if (!runRes.ok) throw new Error(`Apify start failed: ${runRes.status}`);
  const { data: run } = await runRes.json();
  const runId: string = run.id;

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/runs/${runId}?token=${APIFY_TOKEN}`
    );
    const { data: status } = await statusRes.json();
    if (["SUCCEEDED", "FAILED", "ABORTED"].includes(status.status)) {
      if (status.status !== "SUCCEEDED") throw new Error(`Apify run ${status.status}`);
      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${status.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=24`
      );
      const raw: ApifyPost[] = itemsRes.ok ? await itemsRes.json() : [];
      return raw.map((p) => ({
        type: p.type ?? p.productType ?? "Image",
        caption: p.caption ?? "",
        likes: p.likesCount ?? 0,
        comments: p.commentsCount ?? 0,
        views: p.videoViewCount ?? p.videoPlayCount ?? null,
        date: p.timestamp ?? p.takenAt ?? "",
        url: p.url ?? p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : "",
        hashtags: p.hashtags ?? [],
      }));
    }
  }
  throw new Error("Apify run timed out");
}

// ── Claude analysis ────────────────────────────────────────────────────────────

async function analyzeInstagram(
  businessName: string,
  handle: string,
  posts: InstagramPost[]
): Promise<AnalysisResult> {
  const postSummary = posts.map((p, i) => ({
    n: i + 1,
    type: p.type,
    date: p.date,
    likes: p.likes,
    comments: p.comments,
    views: p.views,
    caption: p.caption.slice(0, 300),
    hashtags: p.hashtags.slice(0, 10),
  }));

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an Instagram content strategist. Analyze the last ${posts.length} posts for @${handle} (${businessName}) and return a JSON object with this exact structure:

{
  "score": <integer 0-100 representing overall content health>,
  "summary": "<2-3 sentence executive summary of their Instagram performance>",
  "cadence": "<e.g. '14 posts in 30 days — consistent' or '6 posts in 30 days — inconsistent'>",
  "top_posts": [
    {"url": "<post url>", "type": "<type>", "likes": <n>, "comments": <n>, "why_it_worked": "<1 sentence specific reason>"},
    {"url": "<post url>", "type": "<type>", "likes": <n>, "comments": <n>, "why_it_worked": "<1 sentence specific reason>"},
    {"url": "<post url>", "type": "<type>", "likes": <n>, "comments": <n>, "why_it_worked": "<1 sentence specific reason>"}
  ],
  "format_performance": {
    "reels": "<performance summary or 'No data'>",
    "carousels": "<performance summary or 'No data'>",
    "images": "<performance summary or 'No data'>"
  },
  "content_pillars": ["<theme 1>", "<theme 2>", "<theme 3>"],
  "winning_hooks": ["<hook opener 1>", "<hook opener 2>"],
  "underperforming_hooks": ["<hook opener 1>", "<hook opener 2>"],
  "playbook": [
    "<specific recommendation 1>",
    "<specific recommendation 2>",
    "<specific recommendation 3>",
    "<specific recommendation 4>"
  ]
}

Post data:
${JSON.stringify(postSummary, null, 2)}

Return ONLY valid JSON. No markdown, no explanation.`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as AnalysisResult;
}

// ── HTML report ────────────────────────────────────────────────────────────────

function buildReportHtml(
  businessName: string,
  handle: string,
  analysis: AnalysisResult,
  runDate: string
): string {
  const scoreColor = analysis.score >= 70 ? "#22C55E" : analysis.score >= 45 ? "#F59E0B" : "#EF4444";

  const top3Html = analysis.top_posts
    .map(
      (p) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E0D8;">
        <a href="${p.url}" style="font-family:Arial,sans-serif;font-size:13px;color:#4A6FA5;">${p.url}</a>
        <span style="margin-left:8px;font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;">${p.type}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E0D8;text-align:center;font-family:Arial,sans-serif;font-size:13px;color:#1C1917;">${p.likes.toLocaleString()}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E0D8;text-align:center;font-family:Arial,sans-serif;font-size:13px;color:#1C1917;">${p.comments.toLocaleString()}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E0D8;font-family:Arial,sans-serif;font-size:12px;color:#4B5563;">${p.why_it_worked}</td>
    </tr>`
    )
    .join("");

  const playbookHtml = analysis.playbook
    .map(
      (r, i) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #F0EDE8;">
        <span style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#4A6FA5;margin-right:10px;">${i + 1}</span>
        <span style="font-family:Arial,sans-serif;font-size:13px;color:#1C1917;">${r}</span>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Instagram Content Report — ${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
<tr><td>
<table width="660" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">

  <!-- Header -->
  <tr>
    <td style="background:#4A6FA5;padding:28px 36px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="background:rgba(255,255,255,0.2);border-radius:50%;width:32px;height:32px;text-align:center;vertical-align:middle;">
          <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#FFFFFF;">F10</span>
        </td>
        <td style="padding-left:12px;">
          <span style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#FFFFFF;">F10 Strategy</span>
        </td>
      </tr></table>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);margin:10px 0 0;">Instagram Content Report &nbsp;|&nbsp; ${businessName}</p>
      <p style="font-family:Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.5);margin:4px 0 0;">@${handle} &nbsp;&bull;&nbsp; ${runDate}</p>
    </td>
  </tr>

  <!-- Score -->
  <tr>
    <td style="padding:28px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;border-radius:8px;padding:20px 24px;">
        <tr>
          <td>
            <p style="font-family:Georgia,serif;font-size:48px;font-weight:700;color:${scoreColor};margin:0;line-height:1;">${analysis.score}</p>
            <p style="font-family:Arial,sans-serif;font-size:11px;color:#6B7280;margin:2px 0 0;text-transform:uppercase;letter-spacing:0.05em;">Content Health Score</p>
          </td>
          <td style="padding-left:24px;">
            <p style="font-family:Arial,sans-serif;font-size:13px;color:#4B5563;line-height:1.6;margin:0;">${analysis.summary}</p>
            <p style="font-family:Arial,sans-serif;font-size:12px;color:#6B7280;margin:8px 0 0;">${analysis.cadence}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Top Posts -->
  <tr>
    <td style="padding:24px 36px 0;">
      <p style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#1C1917;margin:0 0 12px;">Top 3 Posts This Period</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E0D8;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#F7F9FC;">
            <th style="padding:10px 16px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Post</th>
            <th style="padding:10px 16px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Likes</th>
            <th style="padding:10px 16px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Comments</th>
            <th style="padding:10px 16px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Why It Worked</th>
          </tr>
        </thead>
        <tbody>${top3Html}</tbody>
      </table>
    </td>
  </tr>

  <!-- Format Performance -->
  <tr>
    <td style="padding:24px 36px 0;">
      <p style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#1C1917;margin:0 0 12px;">Format Performance</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${["Reels", "Carousels", "Images"]
            .map(
              (f) => `<td width="33%" style="padding-right:12px;vertical-align:top;">
            <div style="background:#EEF2F7;border-radius:8px;padding:14px 16px;">
              <p style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#4A6FA5;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;">${f}</p>
              <p style="font-family:Arial,sans-serif;font-size:12px;color:#4B5563;margin:0;line-height:1.5;">${analysis.format_performance[f.toLowerCase() as keyof typeof analysis.format_performance]}</p>
            </div>
          </td>`
            )
            .join("")}
        </tr>
      </table>
    </td>
  </tr>

  <!-- Content Pillars -->
  <tr>
    <td style="padding:24px 36px 0;">
      <p style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#1C1917;margin:0 0 12px;">Content Pillars</p>
      <table cellpadding="0" cellspacing="0"><tr>
        ${analysis.content_pillars
          .map(
            (p) => `<td style="padding-right:8px;">
          <span style="background:#EEF2F7;border-radius:20px;padding:6px 14px;font-family:Arial,sans-serif;font-size:12px;color:#4A6FA5;">${p}</span>
        </td>`
          )
          .join("")}
      </tr></table>
    </td>
  </tr>

  <!-- Hooks -->
  <tr>
    <td style="padding:24px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="padding-right:12px;vertical-align:top;">
            <p style="font-family:Georgia,serif;font-size:14px;font-weight:600;color:#1C1917;margin:0 0 10px;">Winning Hooks</p>
            ${analysis.winning_hooks
              .map(
                (h) => `<div style="background:#F0FDF4;border-left:3px solid #22C55E;padding:8px 12px;margin-bottom:8px;border-radius:0 4px 4px 0;">
              <p style="font-family:Arial,sans-serif;font-size:12px;color:#166534;margin:0;">"${h}"</p>
            </div>`
              )
              .join("")}
          </td>
          <td width="50%" style="padding-left:12px;vertical-align:top;">
            <p style="font-family:Georgia,serif;font-size:14px;font-weight:600;color:#1C1917;margin:0 0 10px;">Underperforming Hooks</p>
            ${analysis.underperforming_hooks
              .map(
                (h) => `<div style="background:#FEF2F2;border-left:3px solid #EF4444;padding:8px 12px;margin-bottom:8px;border-radius:0 4px 4px 0;">
              <p style="font-family:Arial,sans-serif;font-size:12px;color:#991B1B;margin:0;">"${h}"</p>
            </div>`
              )
              .join("")}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Next Week Playbook -->
  <tr>
    <td style="padding:24px 36px;">
      <p style="font-family:Georgia,serif;font-size:16px;font-weight:600;color:#1C1917;margin:0 0 12px;">Next Week's Playbook</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E0D8;border-radius:8px;overflow:hidden;">
        <tbody>${playbookHtml}</tbody>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#F7F9FC;border-top:1px solid #E5E0D8;padding:20px 36px;text-align:center;">
      <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">F10 Strategy &nbsp;&bull;&nbsp; f10strategy.com</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Email body (summary version) ───────────────────────────────────────────────

function buildEmailBodyHtml(
  businessName: string,
  handle: string,
  analysis: AnalysisResult,
  runDate: string
): string {
  const scoreColor = analysis.score >= 70 ? "#22C55E" : analysis.score >= 45 ? "#F59E0B" : "#EF4444";
  const playbookHtml = analysis.playbook
    .map(
      (r, i) => `<p style="font-family:Arial,sans-serif;font-size:13px;color:#4B5563;margin:0 0 8px;"><strong style="color:#4A6FA5;">${i + 1}.</strong> ${r}</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAFAF9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;padding:40px 20px;">
<tr><td>
<table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#FFFFFF;border-radius:12px;border:1px solid #E5E0D8;overflow:hidden;">
  <tr>
    <td style="background:#4A6FA5;padding:24px 36px;">
      <span style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#FFFFFF;">F10 Strategy</span>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);margin:6px 0 0;">Weekly Instagram Report &nbsp;|&nbsp; ${runDate}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:28px 36px 20px;">
      <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#1C1917;margin:0 0 6px;">${businessName}</p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#6B7280;margin:0 0 20px;">@${handle}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <tr>
          <td>
            <span style="font-family:Georgia,serif;font-size:40px;font-weight:700;color:${scoreColor};">${analysis.score}</span>
            <span style="font-family:Arial,sans-serif;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-top:2px;">Content Health Score</span>
          </td>
          <td style="padding-left:20px;">
            <p style="font-family:Arial,sans-serif;font-size:13px;color:#4B5563;line-height:1.6;margin:0;">${analysis.summary}</p>
          </td>
        </tr>
      </table>

      <p style="font-family:Georgia,serif;font-size:15px;font-weight:600;color:#1C1917;margin:0 0 10px;">Next Week's Playbook</p>
      ${playbookHtml}
    </td>
  </tr>
  <tr>
    <td style="padding:0 36px 28px;">
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#6B7280;margin:0 0 4px;">Full analysis attached — top posts, format breakdown, hooks, content pillars.</p>
    </td>
  </tr>
  <tr>
    <td style="background:#F7F9FC;border-top:1px solid #E5E0D8;padding:16px 36px;text-align:center;">
      <p style="font-family:Arial,sans-serif;font-size:11px;color:#9CA3AF;margin:0;">F10 Strategy &nbsp;&bull;&nbsp; f10strategy.com</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Telegram ───────────────────────────────────────────────────────────────────

async function sendTelegramSummary(processed: number, sent: number, failed: number, skipped: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: [
        "📊 WEEKLY SOCIAL REPORTS",
        "",
        `Processed: ${processed}`,
        `Sent: ${sent}`,
        `Failed: ${failed}`,
        skipped > 0
          ? `⚠️ Skipped: ${skipped} (ran out of time this invocation — will pick up next scheduled run)`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id,business_name,contact_email,report_email,instagram_handle")
    .eq("weekly_report_enabled", true)
    .not("instagram_handle", "is", null)
    .neq("instagram_handle", "");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const runDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // maxDuration is 300s and Vercel kills the function hard past that — no
  // try/catch can react to it, no record gets written for whatever client
  // was mid-flight, and sendTelegramSummary() below never runs. A single
  // client's worst case (Apify poll can take up to 60*3s = 180s, plus a
  // Claude call and a Resend send) means anything past a couple of clients
  // risks a silent hard kill. Bail out before starting a new client once
  // there isn't enough budget left to safely finish one, so the loop always
  // exits normally and the summary (with a skipped count) always fires.
  const startedAt = Date.now();
  const HARD_LIMIT_MS = 290_000; // stay under the 300s ceiling with margin
  const PER_CLIENT_BUDGET_MS = 200_000; // worst-case single client: scrape + analyze + send

  const clientList = clients ?? [];
  for (let i = 0; i < clientList.length; i++) {
    if (Date.now() - startedAt > HARD_LIMIT_MS - PER_CLIENT_BUDGET_MS) {
      skipped = clientList.length - i;
      break;
    }
    const client = clientList[i];
    const reportRecord = {
      client_id: client.id,
      business_name: client.business_name,
      instagram_handle: client.instagram_handle,
      status: "pending" as string,
      score: null as number | null,
      summary: null as string | null,
      report_html: null as string | null,
      error: null as string | null,
    };

    try {
      const posts = await scrapeInstagram(client.instagram_handle);
      if (posts.length < 3) throw new Error(`Only ${posts.length} posts found — skipping`);

      const analysis = await analyzeInstagram(client.business_name, client.instagram_handle, posts);
      const fullHtml = buildReportHtml(client.business_name, client.instagram_handle, analysis, runDate);
      const bodyHtml = buildEmailBodyHtml(client.business_name, client.instagram_handle, analysis, runDate);

      const toEmail = client.report_email || client.contact_email;
      if (!toEmail) throw new Error("No recipient email");

      const { error: sendError } = await resend.emails.send({
        from: "F10 Strategy <reports@f10strategy.com>",
        to: [toEmail],
        subject: `${client.business_name} — Weekly Content Report`,
        html: bodyHtml,
        attachments: [
          {
            filename: "content-report.html",
            content: Buffer.from(fullHtml).toString("base64"),
          },
        ],
      });

      if (sendError) throw new Error(sendError.message);

      reportRecord.status = "sent";
      reportRecord.score = analysis.score;
      reportRecord.summary = analysis.summary;
      reportRecord.report_html = fullHtml;
      sent++;
    } catch (err) {
      reportRecord.status = "failed";
      reportRecord.error = err instanceof Error ? err.message : String(err);
      failed++;
    }

    await supabase.from("social_reports").insert(reportRecord);
  }

  await sendTelegramSummary(clientList.length, sent, failed, skipped);
  return NextResponse.json({ processed: clientList.length, sent, failed, skipped });
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApifyPost {
  type?: string;
  productType?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  takenAt?: string;
  url?: string;
  shortCode?: string;
  hashtags?: string[];
}

interface InstagramPost {
  type: string;
  caption: string;
  likes: number;
  comments: number;
  views: number | null;
  date: string;
  url: string;
  hashtags: string[];
}

interface AnalysisResult {
  score: number;
  summary: string;
  cadence: string;
  top_posts: { url: string; type: string; likes: number; comments: number; why_it_worked: string }[];
  format_performance: { reels: string; carousels: string; images: string };
  content_pillars: string[];
  winning_hooks: string[];
  underperforming_hooks: string[];
  playbook: string[];
}
