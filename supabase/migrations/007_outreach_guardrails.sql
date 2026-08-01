-- Outreach guardrails for autonomy buildout, step 1 + step 2:
-- prospecting_sends records each individual send (1 row per email in the
-- 3-touch sequence) so an inbound Resend webhook event can be traced back
-- to a lead. email_events logs delivered/bounced/complained events.
-- suppressed_emails blocks future sends to addresses that hard-bounced or
-- complained, checked by the approve route before every send.

CREATE TABLE IF NOT EXISTS prospecting_sends (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id           UUID        REFERENCES prospecting_leads(id) ON DELETE CASCADE,
  email_number      INTEGER     NOT NULL CHECK (email_number IN (1,2,3)),
  recipient_email   TEXT        NOT NULL,
  resend_message_id TEXT        UNIQUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prospecting_sends_message_id ON prospecting_sends(resend_message_id);
CREATE INDEX IF NOT EXISTS idx_prospecting_sends_lead ON prospecting_sends(lead_id);

CREATE TABLE IF NOT EXISTS email_events (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  resend_message_id TEXT,
  recipient_email   TEXT,
  event_type        TEXT        NOT NULL CHECK (event_type IN ('delivered','bounced','complained','other')),
  lead_id           UUID        REFERENCES prospecting_leads(id) ON DELETE SET NULL,
  raw               JSONB       DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_events(resend_message_id);

CREATE TABLE IF NOT EXISTS suppressed_emails (
  email      TEXT        PRIMARY KEY,
  reason     TEXT        NOT NULL CHECK (reason IN ('bounced','complained','manual')),
  source     TEXT        DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prospecting_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppressed_emails ENABLE ROW LEVEL SECURITY;

-- Same allow_all pattern as every sibling table: internal tool, no Supabase
-- Auth, gated by the app's own session cookie / CRON_SECRET header instead.
DO $$ BEGIN
  CREATE POLICY "allow_all_prospecting_sends" ON prospecting_sends FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_email_events" ON email_events FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_suppressed_emails" ON suppressed_emails FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
