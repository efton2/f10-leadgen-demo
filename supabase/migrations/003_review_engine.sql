-- Review Engine v1: per-client Google review link + review request tracking.
-- v1 scope: manual trigger, email only, single link to every customer (no
-- gating branch — Google review-solicitation compliance). Reminder fires on
-- a fixed delay, not on review-detection, because that requires the Google
-- Business Profile API (deferred to v2). See memory project_simporic_review_engine.md.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_review_link TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS review_requests (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_name  TEXT        NOT NULL,
  customer_email TEXT        NOT NULL,
  status         TEXT        DEFAULT 'queued' NOT NULL
                             CHECK (status IN ('queued','sent','reminded','failed')),
  error          TEXT        DEFAULT '',
  requested_at   TIMESTAMPTZ,
  reminded_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_client_id ON review_requests(client_id);

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_review_requests" ON review_requests FOR ALL USING (true) WITH CHECK (true);
