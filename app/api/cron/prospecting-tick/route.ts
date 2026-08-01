import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { runTick } from "@/lib/prospecting/runner";

export const maxDuration = 300;

// Leave headroom under the 300s function ceiling so a batch mid-tick isn't
// hard-killed by Vercel — same reasoning as weekly-social-reports.
const DEADLINE_MS = 280_000;

// GET /api/cron/prospecting-tick — Vercel cron replacement for the
// tab-open dependency. Advances every batch still in 'running' status by
// one tick each, same runTick used by the browser-driven /api/prospecting/tick.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const { data: batches, error } = await supabase
    .from("prospecting_batches")
    .select("id")
    .eq("status", "running");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ batchId: string; processed: number; remaining: number; batchStatus: string }> = [];
  for (const b of batches ?? []) {
    if (Date.now() - started > DEADLINE_MS) break;
    const result = await runTick(b.id);
    results.push({ batchId: b.id, ...result });
  }

  return NextResponse.json({ batchesTicked: results.length, results });
}
