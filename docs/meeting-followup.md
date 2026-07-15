# Workflow #1 — Meeting → Follow-up → Money

Turns a finished call into a review-ready package: a recap, action items, a deal
read, a **drafted** follow-up email, and a suggested next meeting. The expensive
manual loop (writing the recap, drafting the follow-up, remembering to invoice
and re-book) collapses into a two-minute review.

This is the **core brain** pass. Stripe (payment links) and Calendly (booking)
execution are designed-in but layered on next — see *Roadmap* below.

## Autonomy model: Hybrid

| Step | Who does it |
| --- | --- |
| Summary, key points, action items | Auto, final |
| Deal detection + suggested amount | Auto, saved as `pending_review` |
| Follow-up email | Auto-**drafted**, saved as `draft` — **never auto-sent** |
| Next-meeting suggestion | Auto-suggested, saved as `suggested` |
| Telegram "digest ready" ping | Auto (internal, low-risk) |
| Send email / charge card / book call | **Human approval required** (pass 2) |

Nothing client-facing leaves the building without a human click.

## Pieces

- `lib/meeting-brain.ts` — the brain. `analyzeMeeting(input) → MeetingDigest`.
  Pure transcript-in, structured-digest-out. Model: `claude-sonnet-4-6`.
- `lib/meeting-followup.ts` — `processTranscript(...)`: runs the brain, persists
  the digest as draft/pending, fires the Telegram alert.
- `app/api/meeting-followup` — **POST**, on-demand. Paste/forward a transcript,
  get a digest back synchronously. `queue:true` also records it in history.
- `app/api/cron/meeting-sweep` — **GET**, the always-on layer. Drains pending
  rows from `meeting_transcripts`. Runs every 15 min via `vercel.json`.
- `supabase/migrations/002_meeting_followup.sql` — `meeting_transcripts` (queue)
  + `meeting_digests` (output, with approval-state columns).

## Setup

1. Apply the migration to Supabase (`002_meeting_followup.sql`).
2. Env vars (reuses existing ones where possible):
   - `F10_ANTHROPIC_KEY` — already set.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` — already set.
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — optional, already used by send-proposal.
   - `CRON_SECRET` — **new**. Set it in Vercel; Cron sends it as `Authorization: Bearer <secret>`. If unset, the sweep runs unauthenticated (fine for local dev only).

## Try it (manual)

```bash
curl -s -X POST http://localhost:3000/api/meeting-followup \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Acme Dental — discovery call",
    "host": "Efton",
    "clientName": "Dr. Rivera (Acme Dental)",
    "transcript": "Efton: Thanks for hopping on... [full transcript here]"
  }' | jq
```

Returns `{ digestId, digest }`. The digest holds `summary`, `action_items`,
`deal`, `follow_up_email`, and `next_meeting`.

## How meetings get in (producers)

The sweep is the single consumer; anything can be a producer by inserting a
`pending` row into `meeting_transcripts`:

- **Manual** — POST with `queue:true`.
- **Zoom** (pass 2) — a webhook on `recording.transcript_completed` pulls the
  VTT and inserts a row with `source='zoom'`, `external_id=<meeting uuid>`.
- **Upload** (pass 2) — drag a `.vtt`/`.txt` into the pipeline UI.

## Roadmap (next passes)

1. **Approval UI** in the pipeline page: show the digest, edit the draft, then
   **Send email** (Resend/Gmail), **Create payment link** (Stripe, seeded from
   `suggested_amount`), **Book next call** (Calendly). Flips the `*_status`
   columns from draft → sent/approved.
2. **Zoom ingestion** webhook → auto-populates the queue so the cron sweep has
   real meetings to chew on overnight.
3. **Style learning** — feed the host's recent sent emails as `styleSample` so
   drafts match their voice automatically.
