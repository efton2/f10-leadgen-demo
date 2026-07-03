import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// PATCH /api/prospecting/leads/[leadId] — review-pane edits only.
// Whitelisted fields; the only status change allowed here is 'rejected'.
// Sending happens exclusively through the approve route.
export async function PATCH(req: NextRequest, { params }: { params: { leadId: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.contact_email === "string") {
    updates.contact_email = body.contact_email.trim().toLowerCase();
    updates.email_source = body.email_source === "scraped" ? "scraped" : "manual";
  }
  if (typeof body.proposal_md === "string") updates.proposal_md = body.proposal_md;
  if (Array.isArray(body.emails)) {
    const clean = body.emails
      .filter((e: Record<string, unknown>) => typeof e?.n === "number")
      .map((e: Record<string, unknown>) => ({
        n: e.n,
        subject: String(e.subject ?? "").slice(0, 200),
        body_md: String(e.body_md ?? ""),
        send_offset_days: Number(e.send_offset_days ?? 0),
      }));
    if (clean.length) updates.emails = clean;
  }
  if (body.status === "rejected") updates.status = "rejected";

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No editable fields in request" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("prospecting_leads")
    .update(updates)
    .eq("id", params.leadId)
    .select("id,status,contact_email,email_source")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ lead: data });
}
