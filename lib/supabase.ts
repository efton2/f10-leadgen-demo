// lib/supabase.ts
// Server-only — imported by Next.js Server Components and API routes.
// Not safe for "use client" components (vars lack NEXT_PUBLIC_ prefix).
import { createClient, SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var _supabase: SupabaseClient | undefined;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

// globalThis singleton survives Next.js HMR hot-reload in dev
export const supabase =
  globalThis._supabase ??
  (globalThis._supabase = createClient(supabaseUrl, supabaseAnonKey));
