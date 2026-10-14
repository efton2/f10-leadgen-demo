-- 010: remove anon SELECT on internal ops tables. Server callers use the service-role key (bypasses RLS).
-- Applied to prod 2026-10-14. Restore: ~/handoffs/2026-10-14-placementiq-rls-restore.sql (second batch).
DROP POLICY IF EXISTS anon_read ON public.agent_activity;
DROP POLICY IF EXISTS anon_read ON public.agent_conversations;
DROP POLICY IF EXISTS anon_read ON public.f10_alerts;
DROP POLICY IF EXISTS anon_read ON public.f10_video_queue;
DROP POLICY IF EXISTS anon_read_ai_digest ON public.scout_ai_digest;
DROP POLICY IF EXISTS anon_read_intel ON public.competitor_intel;
DROP POLICY IF EXISTS anon_read_creators ON public.competitor_creators;
