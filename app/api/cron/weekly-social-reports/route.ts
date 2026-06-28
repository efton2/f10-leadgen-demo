import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { cleanHandle, generateSocialReport } from "@/app/lib/socialAudit";
import { weeklyReportEmailHtml } from "@/app/lib/weeklyReportEmail";

// Runs once a week (see vercel.json). Generates a content report for every
// active client that has opted in, emails it, and logs the result.
export const maxDuration = 300;

interface ClientRow {
  id: string;
  business_name: string;
  contact_email: string;
  instagram_handle: string;
  report_email: string;
  weekly_report_enabled: boolean;
}

async function telegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function runWeeklyReports() {
  const { data, error } = await supabase
    .from("clients")
    .select("id, business_name, contact_email, instagram_handle, report_email, weekly_report_enabled")
    .eq("weekly_report_enabled", true);

  if (error) throw new Error(`Failed to load clients: ${error.message}`);

  const clients = ((data ?? []) as ClientRow[]).filter((c) => cleanHandle(c.instagram_handle));
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const results: Array<{ client: string; status: string; detail?: string }> = [];

  for (const client of clients) {
    const handle = cleanHandle(client.instagram_handle);
    const to = (client.report_email || client.contact_email || "").trim();

    try {
      const report = await generateSocialReport(client.business_name, handle);

      let status: "generated" | "sent" | "failed" = "generated";
      let sendError = "";

      if (resend && to) {
        const { error: emailError } = await resend.emails.send({
          from: "F10 Strategy <reports@f10strategy.com>",
          to: [to],
          subject: `${client.business_name} — Weekly Content Report`,
          html: weeklyReportEmailHtml(client.business_name, handle, report.audit),
          attachments: [
            {
              filename: "content-report.html",
              content: Buffer.from(report.html).toString("base64"),
            },
          ],
        });
        if (emailError) {
          status = "failed";
          sendError = String(emailError);
        } else {
          status = "sent";
        }
      }

      await supabase.from("social_reports").insert({
        client_id: client.id,
        business_name: client.business_name,
        handle,
        score: report.score,
        summary: report.audit.account_summary,
        html: report.html,
        status,
        error: sendError,
      });

      results.push({ client: client.business_name, status, detail: sendError || undefined });
    } catch (err) {
      const detail = String(err);
      await supabase.from("social_reports").insert({
        client_id: client.id,
        business_name: client.business_name,
        handle,
        score: 0,
        status: "failed",
        error: detail,
      });
      results.push({ client: client.business_name, status: "failed", detail });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  await telegram(
    [
      "📊 WEEKLY CONTENT REPORTS",
      "",
      `Clients processed: ${results.length}`,
      `Sent: ${sent}`,
      `Failed: ${failed}`,
      ...(failed > 0
        ? ["", "Failures:", ...results.filter((r) => r.status === "failed").map((r) => `  • ${r.client}: ${r.detail}`)]
        : []),
    ].join("\n")
  );

  return { processed: results.length, sent, failed, results };
}

// Vercel Cron invokes the endpoint with GET and an Authorization: Bearer <CRON_SECRET> header.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if not configured
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runWeeklyReports();
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Allow a manual trigger (e.g. from Efton's tooling) with the same auth.
export async function POST(req: NextRequest) {
  return GET(req);
}
