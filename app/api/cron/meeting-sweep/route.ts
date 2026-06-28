import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { processTranscript } from "@/lib/meeting-followup";

export const maxDuration = 300;

// GET — the always-on layer. Vercel Cron hits this on a schedule (see vercel.json).
// It drains the meeting_transcripts queue: any row with status='pending' gets the
// brain run on it, a digest written, and the row marked processed. This is what
// turns the workflow from "click a button" into "wake up to drafted follow-ups".
//
// Producers (a Zoom webhook, an upload, the manual route with queue=true) just
// insert pending rows; this sweep is the single consumer. Stripe/Calendly
// execution is layered on top of the resulting digests in a later pass.
//
// Secured with CRON_SECRET: Vercel Cron sends `Authorization: Bearer <secret>`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.F10_ANTHROPIC_KEY) {
    return NextResponse.json({ error: "Anthropic not configured" }, { status: 500 });
  }

  // Claim a small batch so a single invocation can't run past maxDuration.
  const BATCH = 5;
  const { data: rows, error } = await supabase
    .from("meeting_transcripts")
    .select("id, title, host, attendees, client_email, brand, transcript")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ processed: 0, results: [] });
  }

  const results: Array<{ id: string; ok: boolean; digestId?: string | null; error?: string }> = [];

  for (const row of rows) {
    // Mark processing first so overlapping cron runs don't double-process.
    await supabase
      .from("meeting_transcripts")
      .update({ status: "processing" })
      .eq("id", row.id);

    try {
      const { digestId } = await processTranscript({
        id: row.id,
        title: row.title ?? undefined,
        host: row.host ?? undefined,
        attendees: row.attendees ?? undefined,
        client_email: row.client_email ?? undefined,
        brand: row.brand ?? undefined,
        transcript: row.transcript,
      });
      await supabase
        .from("meeting_transcripts")
        .update({ status: "processed", error: "" })
        .eq("id", row.id);
      results.push({ id: row.id, ok: true, digestId });
    } catch (err) {
      await supabase
        .from("meeting_transcripts")
        .update({ status: "error", error: String(err) })
        .eq("id", row.id);
      results.push({ id: row.id, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
