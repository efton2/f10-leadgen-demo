import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { processTranscript } from "@/lib/meeting-followup";

export const maxDuration = 120;

// POST — process a single meeting transcript on demand.
// Body: { transcript, title?, host?, attendees?, clientName?, clientEmail?,
//         brand?, styleSample?, queue? }
//
// Set queue=true to also drop the transcript into the meeting_transcripts table
// (so it shows up in history alongside cron-ingested meetings). Either way the
// brain runs synchronously and the review-ready digest is returned.
//
// HYBRID: returns a drafted follow-up email and deal read. Nothing is sent.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = typeof body.transcript === "string" ? body.transcript : "";
  if (transcript.trim().length < 40) {
    return NextResponse.json(
      { error: "transcript is required (min 40 chars)" },
      { status: 400 }
    );
  }

  if (!process.env.F10_ANTHROPIC_KEY) {
    return NextResponse.json({ error: "Anthropic not configured" }, { status: 500 });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : undefined);

  let transcriptId: string | undefined;

  // Optionally persist the transcript to the queue/history table first.
  if (body.queue === true) {
    const { data, error } = await supabase
      .from("meeting_transcripts")
      .insert({
        source: "manual",
        title: str("title") ?? "",
        host: str("host") ?? "",
        attendees: str("attendees") ?? "",
        client_email: str("clientEmail") ?? "",
        brand: str("brand") ?? "f10_strategy",
        transcript,
        status: "processing",
      })
      .select("id")
      .single();
    if (!error) transcriptId = data?.id;
  }

  try {
    const { digestId, digest } = await processTranscript(
      {
        id: transcriptId,
        title: str("title"),
        host: str("host"),
        attendees: str("attendees"),
        client_email: str("clientEmail"),
        brand: str("brand"),
        transcript,
      },
      { styleSample: str("styleSample"), clientName: str("clientName") }
    );

    if (transcriptId) {
      await supabase
        .from("meeting_transcripts")
        .update({ status: "processed" })
        .eq("id", transcriptId);
    }

    return NextResponse.json({ digestId, digest });
  } catch (err) {
    if (transcriptId) {
      await supabase
        .from("meeting_transcripts")
        .update({ status: "error", error: String(err) })
        .eq("id", transcriptId);
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
