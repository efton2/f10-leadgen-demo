import { NextRequest, NextResponse } from "next/server";
import { getLeadDetail } from "@/app/lib/getLeadDetail";

export type { LeadDetail } from "@/app/lib/getLeadDetail";

export async function GET(
  _req: NextRequest,
  { params }: { params: { placeId: string } }
) {
  const detail = await getLeadDetail(params.placeId);
  if (!detail) {
    return NextResponse.json({ error: "Failed to load lead detail" }, { status: 502 });
  }
  return NextResponse.json(detail);
}
