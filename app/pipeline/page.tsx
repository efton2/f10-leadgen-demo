// app/pipeline/page.tsx
import { supabase } from "@/lib/supabase";
import PipelineClient from "./PipelineClient";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { data: leads, error } = await supabase
    .from("pipeline_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-f10-bg p-8">
        <p className="font-body text-red-500">Failed to load pipeline: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-f10-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-heading text-3xl text-f10-text mb-2">Lead Pipeline</h1>
        <p className="font-body text-sm text-gray-400 mb-8">{leads?.length ?? 0} leads tracked</p>
        <PipelineClient initialLeads={leads ?? []} />
      </div>
    </main>
  );
}
