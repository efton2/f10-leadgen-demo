# Handoff — Meeting → Follow-up Workflow (Workflow #1)

> For a local Claude Code session continuing this work. Read this top to bottom
> first; it has everything you need to resume without re-deriving context.

## TL;DR

We're building a personal AI-ops layer for Efton, distilled from a review of
PewDiePie's "Odysseus" project. The portable pattern is **agent + schedule +
already-connected tools**. We picked three workflows; **Workflow #1 (Meeting →
follow-up → money) is in progress** — the *core brain* is built and pushed, the
*approval UI + Stripe/Calendly execution* are not yet built.

- **Branch:** `claude/odysseus-features-review-X5yPf`
- **Draft PR:** https://github.com/efton2/f10-leadgen-demo/pull/2
- **Stack:** Next.js 14 (app router), Supabase (anon key, server-side), Anthropic
  SDK (`claude-sonnet-4-6`), Resend, optional Telegram alerts. Deploys on Vercel.

## Decisions already locked (don't re-litigate)

| Decision | Choice |
| --- | --- |
| Autonomy | **Hybrid** — internal artifacts auto-final; client-facing (email send, Stripe charge, booking) requires human approval |
| First scope | **Core brain first** — transcript → summary/action items/deal/draft email; Stripe + Calendly layered on next |
| Runtime | **Cron route in this repo** (Vercel Cron), reusing existing Claude + Supabase setup |

## What's built (this branch, PR #2)

| File | Role |
| --- | --- |
| `lib/meeting-brain.ts` | THE BRAIN. `analyzeMeeting(input) → MeetingDigest`. Pure transcript-in, structured-out. JSON-mode prompt, defensive `normalize()`. |
| `lib/meeting-followup.ts` | `processTranscript()`: runs brain, persists digest as draft/pending, fires internal Telegram alert. Shared by both routes. |
| `app/api/meeting-followup/route.ts` | POST, on-demand. Body `{ transcript, title?, host?, attendees?, clientName?, clientEmail?, brand?, styleSample?, queue? }` → `{ digestId, digest }`. |
| `app/api/cron/meeting-sweep/route.ts` | GET, the always-on layer. Drains `meeting_transcripts` where `status='pending'` (batch 5). Auth via `Bearer ${CRON_SECRET}`. |
| `supabase/migrations/002_meeting_followup.sql` | `meeting_transcripts` (ingest queue) + `meeting_digests` (output, with `*_status` approval columns). |
| `vercel.json` | Cron: `/api/cron/meeting-sweep` every 15 min. |
| `scripts/try-meeting-brain.ts` + `scripts/sample-transcript.txt` | No-DB/no-server local demo. `npm run try:brain`. |
| `docs/meeting-followup.md` | Setup + roadmap (user-facing). |

### Data model quick ref
- `meeting_transcripts.status`: `pending → processing → processed | error`. Single consumer = the cron sweep. Producers just insert `pending` rows.
- `meeting_digests`: `email_status` defaults `draft`, `deal_status` `pending_review`, `booking_status` `suggested`. **These flipping to sent/approved/booked is the approval-UI job (not built).**

## Verified vs NOT verified

- ✅ `tsc --noEmit` clean, `next lint` clean on all new files.
- ✅ `npm run try:brain` wiring runs (tsx loads, imports resolve, sample reads).
- ❌ **No live model call has ever run** — the sandbox had no API keys. The very
  first real run happens locally. **Sanity-check the deal detection and email
  tone on a real transcript before building anything that touches money.**
- ❌ Migration `002` not yet applied to any Supabase project.
- ❌ Routes not exercised against a live DB.

## First thing to do locally (see it work)

```bash
git checkout claude/odysseus-features-review-X5yPf && git pull
npm install
# Level 1 — brain only, no DB:
F10_ANTHROPIC_KEY=sk-ant-... npm run try:brain
# expect: ~$2,500 setup deal, "discovery" stage, drafted follow-up email
```

Then Level 2 (full route) needs `.env.local` with `F10_ANTHROPIC_KEY`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and migration `002` applied. See
`docs/meeting-followup.md` for the curl commands.

## Env vars

| Var | Status | Notes |
| --- | --- | --- |
| `F10_ANTHROPIC_KEY` | existing | brain + all routes |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | existing | persistence |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | existing, optional | digest-ready alert |
| `RESEND_API_KEY` | existing | needed for pass-2 email send |
| `CRON_SECRET` | **NEW — must add in Vercel** | cron auth; `Authorization: Bearer <secret>` |

## Next passes (priority order)

1. **Sanity-check the brain** on 1–2 real transcripts. Tune the prompt in
   `lib/meeting-brain.ts` if deal read or email voice is off. Cheap, do first.
2. **Approval UI** in the pipeline page (`app/pipeline/`): list `meeting_digests`,
   show summary/action items/deal/draft, allow editing the draft, then three
   buttons that flip the status columns:
   - **Send email** — Resend (pattern in `app/api/send-proposal/route.ts`).
   - **Create payment link** — Stripe, seed amount from `digest.deal.suggested_amount`.
   - **Book next call** — Calendly (single-use scheduling link), seed from
     `digest.next_meeting`.
   Build these as new API routes under `app/api/meeting-followup/` (e.g.
   `approve-email`, `create-payment-link`, `create-booking`).
3. **Zoom ingestion** webhook on `recording.transcript_completed` → fetch VTT →
   insert `meeting_transcripts` row (`source='zoom'`, `external_id=<uuid>`). Then
   the cron sweep processes real meetings overnight with zero manual steps.
4. **Style learning** — pass the host's recent sent emails as `styleSample` so
   drafts match their voice automatically.

## Connected tools available (from the original session)

Efton has these MCP/API integrations live, which is the raw material for pass 2
and the other workflows: Zoom, Calendly, Google Calendar, Gmail, MailerLite,
Stripe, Canva, Bitly, Google Drive, Supabase, Vercel, GitHub.

## The other two workflows (not started — for later)

- **#2 Inbound email triage + draft** — scheduled Gmail read → label → draft
  replies into drafts for approval. Same trigger→Claude→tools pattern.
- **#3 Content → distribution** — one asset → Canva graphic + MailerLite campaign
  + Bitly tracked link, scheduled out.

## Gotchas / notes

- `lib/supabase.ts` **throws at import** if `SUPABASE_URL`/`SUPABASE_ANON_KEY` are
  missing — so `next build` and any route import needs them set. (Pre-existing.)
- The brain prompt caps transcript at 60k chars and `styleSample` at 3k. Bump in
  `lib/meeting-brain.ts` if needed.
- Model is `claude-sonnet-4-6` for cost (Efton optimizes for time/money, not
  per-call price). Bump to Opus only if deal-read quality demands it.
- Telegram alerts are best-effort (wrapped in try/catch) — never fail a job.
