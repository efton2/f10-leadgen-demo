// lib/meeting-followup.ts
// Shared persistence + notification layer for Workflow #1, used by both the
// manual route (app/api/meeting-followup) and the cron sweep (app/api/cron/meeting-sweep).
//
// HYBRID AUTONOMY: this layer runs the brain and saves everything, then fires an
// internal Telegram alert (low-risk, auto). It NEVER sends the client follow-up
// email or creates a Stripe charge — those stay in 'draft' / 'pending_review'
// until a human approves them. That approval path is added in pass 2.
import { supabase } from "@/lib/supabase";
import { analyzeMeeting, type BrainInput, type MeetingDigest } from "@/lib/meeting-brain";

export interface TranscriptRow {
  id?: string;
  title?: string;
  host?: string;
  attendees?: string;
  client_email?: string;
  brand?: string;
  transcript: string;
}

export interface ProcessResult {
  digestId: string | null;
  digest: MeetingDigest;
}

/**
 * Run the brain on one transcript, persist the digest (draft/pending), and alert.
 * If `transcriptId` is provided, the digest is linked to that queue row.
 */
export async function processTranscript(
  row: TranscriptRow,
  opts: { styleSample?: string; clientName?: string } = {}
): Promise<ProcessResult> {
  const input: BrainInput = {
    transcript: row.transcript,
    title: row.title,
    host: row.host,
    attendees: row.attendees,
    clientName: opts.clientName,
    styleSample: opts.styleSample,
  };

  const digest = await analyzeMeeting(input);

  // Persist. Client-facing artifacts intentionally land as draft / pending_review.
  const { data, error } = await supabase
    .from("meeting_digests")
    .insert({
      transcript_id: row.id ?? null,
      title: row.title ?? "",
      summary: digest.summary,
      sentiment: digest.sentiment,
      digest,
      is_deal: digest.deal.is_deal,
      deal_stage: digest.deal.stage,
      suggested_amount: digest.deal.suggested_amount,
      currency: digest.deal.currency,
      deal_status: "pending_review",
      email_subject: digest.follow_up_email.subject,
      email_body: digest.follow_up_email.body,
      email_status: "draft",
      next_meeting: digest.next_meeting,
      booking_status: digest.next_meeting.recommended ? "suggested" : "dismissed",
    })
    .select("id")
    .single();

  if (error) {
    // Surface DB errors loudly — a silent insert failure would lose the digest.
    throw new Error(`Failed to persist digest: ${error.message}`);
  }

  await sendDigestAlert(row, digest);

  return { digestId: data?.id ?? null, digest };
}

/** Internal Telegram ping so the host knows a digest is waiting for review. */
async function sendDigestAlert(row: TranscriptRow, digest: MeetingDigest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const d = digest.deal;
  const dealLine = d.is_deal
    ? `Deal: ${d.stage}${
        d.suggested_amount != null
          ? ` · ~${d.currency.toUpperCase()} ${d.suggested_amount.toLocaleString()}`
          : ""
      } (${d.confidence})`
    : "Deal: none detected";

  const actions = digest.action_items
    .slice(0, 5)
    .map((a) => `  • [${a.owner}] ${a.task}${a.due ? ` (${a.due})` : ""}`)
    .join("\n");

  const message = [
    "🧠 MEETING DIGEST READY",
    "",
    `Meeting: ${row.title || "Untitled"}`,
    `Sentiment: ${digest.sentiment}`,
    dealLine,
    "",
    "Action items:",
    actions || "  (none)",
    "",
    "📧 Follow-up email DRAFTED (awaiting your approval to send).",
    digest.next_meeting.recommended ? "📅 Next meeting suggested." : "",
    "",
    "Review in the pipeline before anything goes out.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch {
    // Alerting is best-effort; never fail the whole job over a Telegram hiccup.
  }
}
