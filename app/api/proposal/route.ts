import { NextRequest, NextResponse } from "next/server";
import { generateProposal } from "@/lib/enrichment/proposal";

export async function POST(req: NextRequest) {
  const { name, niche, address, rating, reviewCount, phone, website, snapshot } =
    await req.json();

  if (!process.env.F10_ANTHROPIC_KEY) {
    return NextResponse.json({ error: "Anthropic not configured" }, { status: 500 });
  }

  const proposal = await generateProposal({
    name, niche, address, rating, reviewCount, phone, website, snapshot,
  });

  return NextResponse.json({ proposal });
}
