-- 009: lock lead/pipeline tables to service_role.
-- Earlier migrations (001-008) created USING (true) policies for public/anon that exposed these tables
-- to the public anon key. The app uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS, so no policy is needed.
-- Applied to prod 2026-10-14. Restore script: ~/handoffs/2026-10-14-placementiq-rls-restore.sql
-- Idempotent: safe to replay after 001-008 on a fresh database. Fails closed if anything is left open.

-- 1. RLS must be on for every table below.
ALTER TABLE public.ace_proof_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ace_proof_retrievals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyricviz_free_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_demo_calls      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_demo_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_sends        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_queue        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_leads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_sends     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppressed_emails     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f10_alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f10_video_queue       ENABLE ROW LEVEL SECURITY;

-- 2. Drop EVERY policy granted to public/anon on the service-only tables (by enumeration, not by guessed name).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('ace_proof_assets','ace_proof_retrievals','clients','email_events','lyricviz_free_usage',
                        'phone_demo_calls','phone_demo_state','pipeline_leads','proposal_sends','prospect_queue',
                        'prospecting_batches','prospecting_leads','prospecting_sends','review_requests',
                        'social_reports','suppressed_emails')
      AND roles && ARRAY['public','anon']::name[]
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- 3. Mixed tables: anon may keep SELECT (anon_read) but not write.
DROP POLICY IF EXISTS anon_insert  ON public.agent_conversations;
DROP POLICY IF EXISTS anon_dismiss ON public.f10_alerts;
DROP POLICY IF EXISTS anon_insert  ON public.f10_video_queue;
DROP POLICY IF EXISTS anon_update  ON public.f10_video_queue;

-- 4. Fail closed: abort if RLS is off or any public/anon write policy remains on these tables.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    AND c.relname IN ('ace_proof_assets','ace_proof_retrievals','agent_conversations','clients','email_events','f10_alerts',
                      'f10_video_queue','lyricviz_free_usage','phone_demo_calls','phone_demo_state','pipeline_leads',
                      'proposal_sends','prospect_queue','prospecting_batches','prospecting_leads','prospecting_sends',
                      'review_requests','social_reports','suppressed_emails');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'RLS not enabled on: %', bad; END IF;

  SELECT string_agg(tablename || '.' || policyname, ', ') INTO bad FROM pg_policies
  WHERE schemaname = 'public' AND roles && ARRAY['public','anon']::name[]
    AND ((tablename IN ('ace_proof_assets','ace_proof_retrievals','clients','email_events','lyricviz_free_usage',
                        'phone_demo_calls','phone_demo_state','pipeline_leads','proposal_sends','prospect_queue',
                        'prospecting_batches','prospecting_leads','prospecting_sends','review_requests',
                        'social_reports','suppressed_emails'))
      OR (tablename IN ('agent_conversations','f10_alerts','f10_video_queue') AND cmd <> 'SELECT'));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'open policies remain: %', bad; END IF;
END $$;
