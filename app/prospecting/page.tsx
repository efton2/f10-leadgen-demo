// app/prospecting/page.tsx
import { supabase } from "@/lib/supabase";
import ProspectingClient from "./ProspectingClient";

export const dynamic = "force-dynamic";

export default async function ProspectingPage() {
  const { data: batches, error } = await supabase
    .from("prospecting_batches")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return (
      <main className="min-h-screen bg-f10-bg p-8">
        <p className="font-body text-red-500">Failed to load prospecting: {error.message}</p>
      </main>
    );
  }

  // Per-batch lead status counts for the list view
  const batchIds = (batches ?? []).map((b) => b.id);
  const counts: Record<string, Record<string, number>> = {};
  if (batchIds.length) {
    const { data: leadRows } = await supabase
      .from("prospecting_leads")
      .select("batch_id,status")
      .in("batch_id", batchIds);
    for (const row of leadRows ?? []) {
      counts[row.batch_id] = counts[row.batch_id] ?? {};
      counts[row.batch_id][row.status] = (counts[row.batch_id][row.status] ?? 0) + 1;
    }
  }

  return (
    <main className="min-h-screen bg-f10-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-heading text-3xl text-f10-text mb-2">Prospecting Engine</h1>
        <p className="font-body text-sm text-gray-400 mb-8">
          Pull leads in bulk, enrich automatically, approve every send yourself.
        </p>
        <ProspectingClient initialBatches={batches ?? []} counts={counts} />
      </div>
    </main>
  );
}
