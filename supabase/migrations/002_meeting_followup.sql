-- Meeting → follow-up workflow (Workflow #1)
-- Ingestion queue: one row per meeting that needs processing. Producers
-- (Zoom webhook, manual paste, etc.) drop transcripts here with status 'pending';
-- the cron sweep picks them up and runs the brain.
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source        TEXT        DEFAULT 'manual' NOT NULL
                            CHECK (source IN ('manual','zoom','upload')),
  external_id   TEXT,                       -- e.g. Zoom meeting UUID; UNIQUE-ish guard below
  title         TEXT        DEFAULT '',
  host          TEXT        DEFAULT '',
  attendees     TEXT        DEFAULT '',     -- comma-separated names/emails
  client_email  TEXT        DEFAULT '',     -- where a follow-up would be sent
  brand         TEXT        DEFAULT 'f10_strategy',
  transcript    TEXT        NOT NULL,
  meeting_at    TIMESTAMPTZ,
  status        TEXT        DEFAULT 'pending' NOT NULL
                            CHECK (status IN ('pending','processing','processed','error')),
  error         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Guard against re-ingesting the same external meeting twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_transcripts_external
  ON meeting_transcripts(source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_status
  ON meeting_transcripts(status);

-- Brain output: the structured digest + the drafted (NOT yet sent) follow-up.
-- Hybrid autonomy lives here: internal fields (summary, action items) are final,
-- but anything client-facing stays in *_status = 'draft' until a human approves.
CREATE TABLE IF NOT EXISTS meeting_digests (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  transcript_id      UUID        REFERENCES meeting_transcripts(id) ON DELETE CASCADE,
  title              TEXT        DEFAULT '',
  summary            TEXT        DEFAULT '',
  sentiment          TEXT        DEFAULT 'neutral',
  digest             JSONB       NOT NULL,           -- full MeetingDigest object
  -- Deal detection (drives the future Stripe step)
  is_deal            BOOLEAN     DEFAULT FALSE,
  deal_stage         TEXT        DEFAULT 'none',
  suggested_amount   NUMERIC,
  currency           TEXT        DEFAULT 'usd',
  deal_status        TEXT        DEFAULT 'pending_review' NOT NULL
                                 CHECK (deal_status IN ('pending_review','approved','dismissed')),
  -- Drafted follow-up email (client-facing → requires approval before send)
  email_subject      TEXT        DEFAULT '',
  email_body         TEXT        DEFAULT '',
  email_status       TEXT        DEFAULT 'draft' NOT NULL
                                 CHECK (email_status IN ('draft','approved','sent','dismissed')),
  -- Next-meeting suggestion (drives the future Calendly step)
  next_meeting       JSONB,
  booking_status     TEXT        DEFAULT 'suggested' NOT NULL
                                 CHECK (booking_status IN ('suggested','approved','booked','dismissed')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_digests_transcript ON meeting_digests(transcript_id);
CREATE INDEX IF NOT EXISTS idx_meeting_digests_email_status ON meeting_digests(email_status);

-- Reuse the shared updated_at trigger from 001_pipeline.sql
DROP TRIGGER IF EXISTS meeting_transcripts_updated_at ON meeting_transcripts;
CREATE TRIGGER meeting_transcripts_updated_at
  BEFORE UPDATE ON meeting_transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS meeting_digests_updated_at ON meeting_digests;
CREATE TRIGGER meeting_digests_updated_at
  BEFORE UPDATE ON meeting_digests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS — internal tool using the anon key via Next.js server (matches 001_pipeline.sql)
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_meeting_transcripts" ON meeting_transcripts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_meeting_digests" ON meeting_digests FOR ALL USING (true) WITH CHECK (true);
