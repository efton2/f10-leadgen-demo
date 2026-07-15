-- Stage 7: recurring weekly Instagram content-strategy reports for active clients.
-- Adds per-client report config to `clients` and a log of every generated report.

-- 1. Per-client config: who gets a weekly content report, for which handle, where to send it.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS instagram_handle      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS report_email          TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS weekly_report_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Report history — one row per generated report. Powers a future client portal
--    and gives Efton an audit trail of what was sent and when.
CREATE TABLE IF NOT EXISTS social_reports (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     UUID        REFERENCES clients(id) ON DELETE CASCADE,
  business_name TEXT        NOT NULL,
  handle        TEXT        DEFAULT '',
  score         INTEGER     DEFAULT 0,
  summary       TEXT        DEFAULT '',
  html          TEXT        DEFAULT '',
  status        TEXT        DEFAULT 'generated' NOT NULL
                            CHECK (status IN ('generated','sent','failed')),
  error         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_reports_client_id ON social_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_social_reports_created_at ON social_reports(created_at DESC);

-- 3. RLS — internal tool using the anon key via Next.js server (matches 001_pipeline.sql)
ALTER TABLE social_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_social_reports" ON social_reports FOR ALL USING (true) WITH CHECK (true);
