// app/api/pipeline/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: fetch all pipeline leads, newest first
export async function GET() {
  const { data, error } = await supabase
    .from("pipeline_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data });
}

// POST: upsert a lead by place_id (called from detail page on load)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { place_id, business_name, address, phone, rating, review_count, category, city } = body;

  if (!place_id || !business_name) {
    return NextResponse.json({ error: "place_id and business_name are required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("pipeline_leads")
    .upsert(
      { place_id, business_name, address, phone, rating, review_count, category, city },
      { onConflict: "place_id", ignoreDuplicates: true }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}

// PATCH: update status and/or notes for a lead by id
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, notes } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase
    .from("pipeline_leads")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
