// app/prospecting/[batchId]/page.tsx
import { supabase } from "@/lib/supabase";
import BatchClient from "./BatchClient";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params }: { params: { batchId: string } }) {
  const [{ data: batch, error: batchError }, { data: leads, error: leadsError }] = await Promise.all([
    supabase.from("prospecting_batches").select("*").eq("id", params.batchId).single(),
    supabase
      .from("prospecting_leads")
      .select(
        "id,place_id,business_name,address,phone,website,rating,review_count,category,contact_email,email_source,status,error,audit_score,proposal_md,emails,cost_usd,created_at,updated_at"
      )
      .eq("batch_id", params.batchId)
      .order("created_at", { ascending: true }),
  ]);

  if (batchError || !batch) {
    return (
      <main className="min-h-screen bg-f10-bg p-8">
        <p className="font-body text-red-500">Batch not found: {batchError?.message ?? params.batchId}</p>
      </main>
    );
  }
  if (leadsError) {
    return (
      <main className="min-h-screen bg-f10-bg p-8">
        <p className="font-body text-red-500">Failed to load leads: {leadsError.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-f10-bg p-8">
      <div className="max-w-6xl mx-auto">
        <BatchClient initialBatch={batch} initialLeads={leads ?? []} />
      </div>
    </main>
  );
}
