import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { searchPlacesPaginated } from "@/lib/prospecting/places";
import { estimateBatchCost } from "@/lib/usage";

export const maxDuration = 60;

// POST /api/prospecting/batches — create a batch: pull leads from Places,
// dedupe against pipeline + prior prospecting, insert work items as 'queued'.
// This is the only place external money is spent before the tick runner, and
// it fires only from the "Run Batch (est. $X)" button.
export async function POST(req: NextRequest) {
  const { niche, city, count, depth } = await req.json();

  if (!niche || !city) {
    return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
  }
  const requested = Math.min(Math.max(Number(count) || 10, 1), 60);
  const competitiveDepth = depth === "full" ? "full" : "lite";

  let leads, searchCalls;
  try {
    ({ leads, searchCalls } = await searchPlacesPaginated(niche, city, requested));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  if (!leads.length) {
    return NextResponse.json({ error: "No businesses found for that niche and city" }, { status: 404 });
  }

  // Dedupe against existing pipeline and prior prospecting runs
  const placeIds = leads.map((l) => l.placeId);
  const [{ data: pipelineDupes }, { data: prospectingDupes }] = await Promise.all([
    supabase.from("pipeline_leads").select("place_id").in("place_id", placeIds),
    supabase.from("prospecting_leads").select("place_id").in("place_id", placeIds),
  ]);
  const dupeSet = new Set([
    ...(pipelineDupes ?? []).map((r) => r.place_id),
    ...(prospectingDupes ?? []).map((r) => r.place_id),
  ]);

  const freshCount = leads.filter((l) => !dupeSet.has(l.placeId)).length;
  const estimate = estimateBatchCost({ count: freshCount, depth: competitiveDepth });

  const { data: batch, error: batchError } = await supabase
    .from("prospecting_batches")
    .insert({
      niche,
      city,
      requested_count: requested,
      competitive_depth: competitiveDepth,
      status: "running",
      est_cost_usd: estimate.total,
      est_breakdown: estimate,
      actual_usage: { places_calls: searchCalls },
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? "Failed to create batch" }, { status: 500 });
  }

  const rows = leads.map((l) => ({
    batch_id: batch.id,
    place_id: l.placeId,
    business_name: l.name,
    address: l.address,
    rating: l.rating,
    review_count: l.reviewCount,
    category: l.category,
    status: dupeSet.has(l.placeId) ? "skipped_duplicate" : "queued",
  }));

  const { error: leadsError } = await supabase.from("prospecting_leads").insert(rows);
  if (leadsError) {
    // Roll back the empty batch so it doesn't sit as a phantom run
    await supabase.from("prospecting_batches").delete().eq("id", batch.id);
    return NextResponse.json({ error: leadsError.message }, { status: 500 });
  }

  return NextResponse.json({
    batchId: batch.id,
    total: rows.length,
    queued: freshCount,
    duplicates: rows.length - freshCount,
    estimate,
  });
}
