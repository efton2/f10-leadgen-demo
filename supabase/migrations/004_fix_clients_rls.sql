-- Fix: clients table RLS was tightened to role "authenticated" at some point
-- after 001_pipeline.sql shipped, live-only (migration source still showed
-- allow_all_clients). This app has no Supabase Auth login anywhere -- it
-- gates access with a single shared-password cookie and reads/writes every
-- table server-side with the anon key. Nothing here ever becomes Supabase's
-- "authenticated" role, so the tightened policy silently blocked all reads
-- and writes on clients (the live Clients page was showing a false empty
-- state, not a real one). Restoring the same allow-all/public pattern used
-- by every sibling table (pipeline_leads, prospecting_leads,
-- prospecting_batches, proposal_sends, review_requests).

DROP POLICY IF EXISTS clients_authenticated_only ON clients;

CREATE POLICY "allow_all_clients" ON clients FOR ALL USING (true) WITH CHECK (true);
