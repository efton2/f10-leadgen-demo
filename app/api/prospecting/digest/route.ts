import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/prospecting/digest — list every lead currently auto_queued
// (cleared the threshold, waiting on the single "approve all" action).
export async function GET() {
  const { data, error } = await supabase
    .from("prospecting_leads")
    .select("id,business_name,category,address,contact_email,audit_score,created_at,batch_id")
    .eq("status", "auto_queued")
    .order("audit_score", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}
