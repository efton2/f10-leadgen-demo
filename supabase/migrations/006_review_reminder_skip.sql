-- Review Engine v1 shipped with the reminder firing unconditionally 3 days
-- after the initial request, regardless of whether the customer actually
-- left a review — there is no Google Business Profile API integration in
-- this repo to detect that automatically (deferred to v2, see
-- memory project_simporic_review_engine.md). This adds the closest honest
-- v1 substitute: a manual "mark reviewed" action that cancels the pending
-- Resend-scheduled reminder, so at minimum Efton can stop a nag once he
-- knows a customer already reviewed.

ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS reminder_email_id TEXT;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE review_requests DROP CONSTRAINT IF EXISTS review_requests_status_check;
ALTER TABLE review_requests ADD CONSTRAINT review_requests_status_check
  CHECK (status IN ('queued','sent','reminded','failed','reviewed'));
