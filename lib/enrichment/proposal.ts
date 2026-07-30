// Proposal generation. Extracted from app/api/proposal/route.ts so the manual
// route and the prospecting batch runner share one implementation.
import Anthropic from "@anthropic-ai/sdk";
import { UsageMeter } from "@/lib/usage";
import { PRICING } from "@/lib/pricing";

export interface ProposalInput {
  name: string;
  niche?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  phone?: string;
  website?: string;
  snapshot?: string;
}

export async function generateProposal(input: ProposalInput, meter?: UsageMeter): Promise<string> {
  const apiKey = process.env.F10_ANTHROPIC_KEY;
  if (!apiKey) throw new Error("Anthropic not configured");

  const client = new Anthropic({ apiKey });
  const { name, niche, address, rating, reviewCount, phone, website, snapshot } = input;

  const niceNiche = niche?.replace(/_/g, " ") ?? "local business";
  const ratingLine =
    (rating ?? 0) > 0
      ? `${rating} stars from ${(reviewCount ?? 0).toLocaleString()} reviews`
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
- "Investment" section must state the Standard plan: $${PRICING.standard.setup} one-time setup, $${PRICING.standard.monthly} per month, no long-term contract, cancel any time. End the section with one sentence noting a Managed plan is also available for multi-location or higher-volume businesses at $${PRICING.managed.setup} setup and $${PRICING.managed.monthly} per month, including dedicated call flow optimization
- "Next Steps" must end with a call to action to reply or call to get started
- Keep each section to 3 to 5 sentences max
- Write as if addressing the owner of ${name} directly

Business details:
Name: ${name}
Category: ${niceNiche}
Address: ${address ?? ""}
Rating: ${ratingLine}
${phoneLine}
${websiteLine}${snapshot ? `\n\nAI Business Analysis (use this to personalize the proposal — reference specific strengths from this analysis in the "Why ${name} Stands Out" section):\n${snapshot}` : ""}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  meter?.addClaude(msg.usage);
  return (msg.content[0] as { text: string }).text;
}
