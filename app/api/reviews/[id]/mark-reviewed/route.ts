import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

// PATCH /api/reviews/[id]/mark-reviewed — v1 substitute for automated
// review detection (no Google Business Profile API in this repo). Cancels
// the pending Resend-scheduled reminder if it hasn't gone out yet, and
// marks the request reviewed so the UI stops treating it as pending.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const { data: reviewRequest, error: fetchError } = await supabase
    .from("review_requests")
    .select("id, status, reminder_email_id")
    .eq("id", id)
    .single();

  if (fetchError || !reviewRequest) {
    return NextResponse.json({ error: "Review request not found" }, { status: 404 });
  }

  let cancelNote = "";
  if (reviewRequest.reminder_email_id && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.cancel(reviewRequest.reminder_email_id);
    } catch (err) {
      // Non-fatal — most likely the reminder already sent (Resend returns
      // an error for emails that are no longer in "scheduled" state), which
      // is expected once 3 days have passed. Don't block marking reviewed.
      cancelNote = `Reminder cancel skipped (likely already sent): ${String(err)}`;
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("review_requests")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to mark reviewed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, reviewRequest: updated, cancelNote: cancelNote || undefined });
}
