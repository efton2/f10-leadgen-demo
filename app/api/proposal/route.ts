import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const { name, niche, address, rating, reviewCount, phone, website } =
    await req.json();

  const apiKey = process.env.F10_ANTHROPIC_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic not configured" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  const niceNiche = (niche as string)?.replace(/_/g, " ") ?? "local business";
  const ratingLine =
    rating > 0
      ? `${rating} stars from ${reviewCount.toLocaleString()} reviews`
      : "no public rating data";
  const phoneLine = phone ? `Phone: ${phone}` : "";
  const websiteLine = website ? `Website: ${website}` : "";

  const prompt = `You are a senior sales consultant at Function 10 Media, an AI systems agency. Write a professional sales proposal for an AI Receptionist service tailored to this specific business. Use a warm but authoritative tone. Never use em dashes or hyphens in the body copy. Use short paragraphs. Do not use bullet points. Structure the proposal with these exact markdown headings:

## Why ${name} Stands Out
## The Opportunity
## What We Are Proposing
## What You Get
## Investment
## Next Steps

Rules:
- "What We Are Proposing" section must describe the AI Receptionist: answers calls 24/7, greets callers with the business name, books appointments, handles FAQs, never puts callers on hold
- "What You Get" section must list: 24/7 call coverage, custom greeting for ${name}, appointment intake, FAQ handling, monthly call summary report, live within 48 hours
- "Investment" section must state: $497 one-time setup, $297 per month, no long-term contract, cancel any time
- "Next Steps" must end with a call to action to reply or call to get started
- Keep each section to 3 to 5 sentences max
- Write as if addressing the owner of ${name} directly

Business details:
Name: ${name}
Category: ${niceNiche}
Address: ${address}
Rating: ${ratingLine}
${phoneLine}
${websiteLine}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const proposal = (msg.content[0] as { text: string }).text;
  return NextResponse.json({ proposal });
}
