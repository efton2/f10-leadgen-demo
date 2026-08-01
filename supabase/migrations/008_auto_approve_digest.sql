-- Autonomy buildout step 4: additive auto-queue path alongside the existing
-- manual 'ready' review queue. Leads clearing the confidence threshold
-- (lib/prospecting/autoApprove.ts) land in 'auto_queued' instead of 'ready'.
-- Nothing sends from this status alone — a daily digest surfaces the count,
-- and a single "approve all" action is still required before any email
-- goes out. The manual gate on 'ready' leads is untouched.

ALTER TABLE prospecting_leads DROP CONSTRAINT IF EXISTS prospecting_leads_status_check;
ALTER TABLE prospecting_leads ADD CONSTRAINT prospecting_leads_status_check
  CHECK (status IN ('queued','details_done','audited','competitive_done',
                     'proposal_done','ready','auto_queued','approved','sent',
                     'rejected','skipped_duplicate','failed'));
