// app/prospecting/digest/page.tsx
import { supabase } from "@/lib/supabase";
import DigestClient from "./DigestClient";

export const dynamic = "force-dynamic";

export default async function DigestPage() {
  const { data: leads, error } = await supabase
    .from("prospecting_leads")
    .select("id,business_name,category,address,contact_email,audit_score,created_at")
    .eq("status", "auto_queued")
    .order("audit_score", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-f10-bg p-8">
        <p className="font-body text-red-500">Failed to load digest: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-f10-bg p-8">
      <h1 className="font-heading text-3xl text-f10-text mb-2">Auto-Approve Digest</h1>
      <p className="font-body text-sm text-f10-text/60 mb-6">
        These leads cleared the auto-approve threshold. Nothing has been sent — approve
        the batch below to fire the same 3-email sequence used everywhere else in prospecting.
      </p>
      <DigestClient leads={leads ?? []} />
    </main>
  );
}
