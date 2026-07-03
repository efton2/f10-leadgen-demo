import { NextRequest, NextResponse } from "next/server";
import { runTick } from "@/lib/prospecting/runner";

export const maxDuration = 300;

// POST /api/prospecting/tick — advance a batch's enrichment work within a
// ~240s budget. Called repeatedly by the open batch page while work remains.
export async function POST(req: NextRequest) {
  const { batchId } = await req.json();
  if (!batchId) {
    return NextResponse.json({ error: "batchId required" }, { status: 400 });
  }

  const result = await runTick(batchId);
  return NextResponse.json(result);
}
