import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";

// GET /api/cron/prospecting-digest — daily alert only. Never sends or
// approves anything by itself; it exists so auto_queued leads don't sit
// silently until someone happens to open the digest page. The single
// approve action still lives at POST /api/prospecting/digest/approve.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: leads, error } = await supabase
    .from("prospecting_leads")
    .select("business_name,audit_score")
    .eq("status", "auto_queued")
    .order("audit_score", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads?.length) return NextResponse.json({ queued: 0 });

  const top = leads.slice(0, 10).map((l) => `  ${l.business_name} (${l.audit_score}/100)`);
  await sendTelegram(
    [
      "📬 AUTO-QUEUE DIGEST",
      "",
      `${leads.length} lead${leads.length === 1 ? "" : "s"} cleared the auto-approve threshold, waiting on your go-ahead:`,
      ...top,
      leads.length > 10 ? `  ...and ${leads.length - 10} more` : "",
      "",
      "Nothing has been sent. Review and approve at simporic.com/prospecting/digest",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return NextResponse.json({ queued: leads.length });
}
