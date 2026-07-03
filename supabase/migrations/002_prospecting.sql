-- Prospecting engine: batch runs + per-lead work items with approval gate.
-- A batch pulls leads in bulk, enriches each through a state machine, and
-- queues everything for Efton's per-lead approval. Sending is only possible
-- through the approve route's atomic ready->approved transition.

CREATE TABLE IF NOT EXISTS prospecting_batches (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  niche             TEXT        NOT NULL,
  city              TEXT        NOT NULL,
  requested_count   INTEGER     NOT NULL DEFAULT 10
                                CHECK (requested_count BETWEEN 1 AND 60),
  competitive_depth TEXT        NOT NULL DEFAULT 'lite'
                                CHECK (competitive_depth IN ('lite','full')),
  status            TEXT        NOT NULL DEFAULT 'running'
                                CHECK (status IN ('running','ready_for_review','failed','archived')),
  est_cost_usd      NUMERIC     DEFAULT 0,
  est_breakdown     JSONB       DEFAULT '{}'::jsonb,
  actual_cost_usd   NUMERIC     DEFAULT 0,
  actual_usage      JSONB       DEFAULT '{}'::jsonb,
  telegram_notified BOOLEAN     DEFAULT FALSE,
  error             TEXT        DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospecting_leads (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id         UUID        NOT NULL REFERENCES prospecting_batches(id) ON DELETE CASCADE,
  place_id         TEXT        NOT NULL,
  business_name    TEXT        NOT NULL,
  address          TEXT        DEFAULT '',
  phone            TEXT        DEFAULT '',
  website          TEXT        DEFAULT '',
  rating           NUMERIC     DEFAULT 0,
  review_count     INTEGER     DEFAULT 0,
  category         TEXT        DEFAULT '',
  -- contact
  contact_email    TEXT        DEFAULT '',
  email_source     TEXT        DEFAULT ''
                               CHECK (email_source IN ('','scraped','manual')),
  -- state machine
  status           TEXT        NOT NULL DEFAULT 'queued'
                               CHECK (status IN ('queued','details_done','audited','competitive_done',
                                                 'proposal_done','ready','approved','sent',
                                                 'rejected','skipped_duplicate','failed')),
  processing_at    TIMESTAMPTZ,
  attempt_count    INTEGER     DEFAULT 0,
  error            TEXT        DEFAULT '',
  -- artifacts
  snapshot         TEXT        DEFAULT '',
  audit_score      INTEGER,
  audit_json       JSONB,
  audit_html       TEXT,
  competitive_json JSONB,
  competitive_html TEXT,
  proposal_md      TEXT,
  emails           JSONB,
  -- cost
  usage            JSONB       DEFAULT '{}'::jsonb,
  cost_usd         NUMERIC     DEFAULT 0,
  approved_at      TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (batch_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_prospecting_leads_batch ON prospecting_leads(batch_id, status);

-- Reuse the updated_at trigger function from 001_pipeline.sql
DROP TRIGGER IF EXISTS prospecting_batches_updated_at ON prospecting_batches;
CREATE TRIGGER prospecting_batches_updated_at
  BEFORE UPDATE ON prospecting_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS prospecting_leads_updated_at ON prospecting_leads;
CREATE TRIGGER prospecting_leads_updated_at
  BEFORE UPDATE ON prospecting_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: internal tool using the anon key via Next.js server (same as 001)
ALTER TABLE prospecting_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_prospecting_batches" ON prospecting_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_prospecting_leads" ON prospecting_leads FOR ALL USING (true) WITH CHECK (true);

-- Track where a pipeline lead came from (manual view vs prospecting engine)
ALTER TABLE pipeline_leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '';
