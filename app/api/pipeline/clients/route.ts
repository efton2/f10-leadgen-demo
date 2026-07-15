// app/api/pipeline/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lead_id, business_name, contact_phone } = body;

  if (!business_name) {
    return NextResponse.json({ error: "business_name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      lead_id: lead_id ?? null,
      business_name,
      contact_phone: contact_phone ?? "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = ["contact_name","contact_email","contact_phone","sku","payment_status","provisioning_status","go_live_date","notes","instagram_handle","report_email","weekly_report_enabled"];
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const { data, error } = await supabase
    .from("clients")
    .update(filtered)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}
