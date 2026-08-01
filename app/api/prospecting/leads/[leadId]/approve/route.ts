import { NextRequest, NextResponse } from "next/server";
import { sendOutreachSequence } from "@/lib/prospecting/sendOutreach";

// POST /api/prospecting/leads/[leadId]/approve — manual per-lead approval,
// the original review-gate path. Send logic lives in lib/prospecting/sendOutreach.ts,
// shared with the digest batch-approve route for 'auto_queued' leads.
export async function POST(_req: NextRequest, { params }: { params: { leadId: string } }) {
  const result = await sendOutreachSequence(params.leadId, "ready");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, followUpError: result.followUpError });
}
