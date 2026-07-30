-- Documents live Supabase schema that existed only in the dashboard/MCP
-- migration history (project nxwvstbtispnthcygjzt), not in this repo's
-- migration files. This is a shared project across every F10 brand; its
-- real migration history lives in Supabase's own tracked history (visible
-- via `list_migrations`, timestamp-versioned), which is NOT the same
-- sequence as the 001-004 files in this folder. That split is how these
-- objects went undocumented here in the first place — this file exists so
-- the repo at least reflects reality going forward. All statements are
-- idempotent and safe to run against the live DB (already matches it).

-- clients: columns added by the weekly-social-reports cron feature and by
-- Review Engine v1, never added to 001_pipeline.sql.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram_handle TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS report_email TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS weekly_report_enabled BOOLEAN NOT NULL DEFAULT false;
-- google_review_link is already added by 003_review_engine.sql.

-- proposal_sends: created live for app/api/send-proposal's audit-log insert.
-- Policy is misleadingly named "Service role full access" but its actual
-- `roles` grant is {public} — functionally equivalent to every other
-- allow_all policy in this app (anon key, no Supabase Auth).
CREATE TABLE IF NOT EXISTS proposal_sends (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  place_id        TEXT,
  business_name   TEXT        NOT NULL,
  recipient_email TEXT        NOT NULL,
  niche           TEXT,
  proposal_text   TEXT,
  status          TEXT        DEFAULT 'sent' NOT NULL
);
ALTER TABLE proposal_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "allow_all_proposal_sends" ON proposal_sends FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ace_proof_assets / ace_proof_retrievals: created by a separate, earlier
-- migration ("create_ace_proof_library", Supabase history 20260502043739)
-- for a different consumer using the service_role key. Simporic's
-- app/api/proof/retrieve/route.ts is a later consumer using the anon key
-- (SUPABASE_ANON_KEY, matching every other table access pattern in this
-- app) — but no anon/public policy existed for these two tables, so every
-- select/insert from this route was silently blocked by RLS (default-deny,
-- zero rows / swallowed error, no visible symptom). Fixed live via Supabase
-- MCP migration `fix_ace_proof_rls_for_anon_key` on 2026-07-30 — additive
-- only, the original service_role policy is untouched. Table shapes below
-- for reference; do not re-run the CREATE TABLE (they already exist).
DO $$ BEGIN
  CREATE POLICY "allow_all_ace_proof_assets" ON ace_proof_assets FOR ALL TO public USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "allow_all_ace_proof_retrievals" ON ace_proof_retrievals FOR ALL TO public USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
