import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendOutreachSequence } from "@/lib/prospecting/sendOutreach";

// POST /api/prospecting/digest/approve — the single human action that
// fires the whole auto-queued batch. Optional { leadIds: string[] } body
// approves a subset (for an "approve all except these 2" flow); omitted
// body approves everything currently auto_queued. Still per-lead atomic
// under the hood via sendOutreachSequence — a lead that fails or is
// suppressed by the time this runs is skipped, not silently dropped.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const leadIds: string[] | undefined = Array.isArray(body?.leadIds) ? body.leadIds : undefined;

  let query = supabase.from("prospecting_leads").select("id").eq("status", "auto_queued");
  if (leadIds?.length) query = query.in("id", leadIds);
  const { data: leads, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!leads?.length) return NextResponse.json({ sent: 0, failed: 0, results: [] });

  const results = [];
  for (const lead of leads) {
    const result = await sendOutreachSequence(lead.id, "auto_queued");
    results.push({ leadId: lead.id, ...result });
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  return NextResponse.json({ sent, failed, results });
}
