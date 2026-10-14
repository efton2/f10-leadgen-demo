-- 008: lock lead/pipeline tables to service_role. Earlier migrations created USING (true) policies
-- that exposed these tables to the public anon key. App uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
-- Applied to prod 2026-10-14. Restore script: ~/handoffs/2026-10-14-placementiq-rls-restore.sql
DROP POLICY IF EXISTS allow_all_ace_proof_assets ON public.ace_proof_assets;
DROP POLICY IF EXISTS allow_all_ace_proof_retrievals ON public.ace_proof_retrievals;
DROP POLICY IF EXISTS anon_insert ON public.agent_conversations;
DROP POLICY IF EXISTS allow_all_clients ON public.clients;
DROP POLICY IF EXISTS allow_all_email_events ON public.email_events;
DROP POLICY IF EXISTS anon_dismiss ON public.f10_alerts;
DROP POLICY IF EXISTS anon_insert ON public.f10_video_queue;
DROP POLICY IF EXISTS anon_update ON public.f10_video_queue;
DROP POLICY IF EXISTS "Service role full access" ON public.lyricviz_free_usage;
DROP POLICY IF EXISTS allow_all_phone_demo_calls ON public.phone_demo_calls;
DROP POLICY IF EXISTS allow_all_phone_demo_state ON public.phone_demo_state;
DROP POLICY IF EXISTS allow_all_pipeline_leads ON public.pipeline_leads;
DROP POLICY IF EXISTS "Service role full access" ON public.proposal_sends;
DROP POLICY IF EXISTS "Service role full access" ON public.prospect_queue;
DROP POLICY IF EXISTS allow_all_prospecting_batches ON public.prospecting_batches;
DROP POLICY IF EXISTS allow_all_prospecting_leads ON public.prospecting_leads;
DROP POLICY IF EXISTS allow_all_prospecting_sends ON public.prospecting_sends;
DROP POLICY IF EXISTS allow_all_review_requests ON public.review_requests;
DROP POLICY IF EXISTS allow_all_social_reports ON public.social_reports;
DROP POLICY IF EXISTS anon_all ON public.social_reports;
DROP POLICY IF EXISTS allow_all_suppressed_emails ON public.suppressed_emails;
