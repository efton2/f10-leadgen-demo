import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/prospecting/batches/[batchId] — light poll payload for the batch
// page. Excludes heavy artifact HTML; the artifact route serves those.
export async function GET(_req: NextRequest, { params }: { params: { batchId: string } }) {
  const [{ data: batch }, { data: leads, error }] = await Promise.all([
    supabase.from("prospecting_batches").select("*").eq("id", params.batchId).single(),
    supabase
      .from("prospecting_leads")
      .select(
        "id,place_id,business_name,address,phone,website,rating,review_count,category,contact_email,email_source,status,error,audit_score,proposal_md,emails,cost_usd"
      )
      .eq("batch_id", params.batchId)
      .order("created_at", { ascending: true }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ batch, leads });
}
