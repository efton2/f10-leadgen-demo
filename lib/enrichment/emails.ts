// Three-email outreach sequence generation for the prospecting engine.
// One Claude call returns all three drafts as JSON. Drafts are queued for
// Efton's per-lead review in the approval pane; nothing here sends anything.
import Anthropic from "@anthropic-ai/sdk";
import { UsageMeter } from "@/lib/usage";

const anthropic = new Anthropic({ apiKey: process.env.F10_ANTHROPIC_KEY });

const ACE_URL = "https://ace-f10.pages.dev";

export interface OutreachEmail {
  n: 1 | 2 | 3;
  subject: string;
  body_md: string;
  send_offset_days: number;
}

export interface EmailSequenceInput {
  businessName: string;
  category: string;
  city?: string;
  snapshot?: string;
  auditScore?: number | null;
  auditFindings?: Array<{ severity: string; title: string; detail: string }>;
}

export async function generateEmailSequence(input: EmailSequenceInput, meter?: UsageMeter): Promise<OutreachEmail[]> {
  const { businessName, category, snapshot, auditScore, auditFindings } = input;
  const niceCategory = category?.replace(/_/g, " ") || "local business";
  const aceLink = `${ACE_URL}?business=${encodeURIComponent(businessName)}&category=${encodeURIComponent(category || "")}`;

  const findingsBlock = (auditFindings ?? [])
    .slice(0, 3)
    .map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`)
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `You are a senior sales copywriter at Simporic, which sells an AI Receptionist service to local businesses ($497 setup, $297 per month, live in 48 hours, no contract). Write a 3-email cold outreach sequence to the owner of this business. Return ONLY valid JSON, no markdown fences.

Business: ${businessName}
Category: ${niceCategory}
${auditScore != null ? `Their website marketing audit score: ${auditScore}/100` : "No audit score available"}
${findingsBlock ? `Top audit findings:\n${findingsBlock}` : ""}
${snapshot ? `Business snapshot:\n${snapshot}` : ""}

Email angles (must follow exactly):
1. AUDIT HOOK. Mention we ran a marketing review of their website, cite their score and one or two concrete findings from above. The full audit report is attached to this email. Soft CTA: reply if they want the quick wins list walked through.
2. DEMO ANGLE. Lead with the pain of missed calls for a ${niceCategory}: after hours calls going to voicemail, callers hanging up and phoning the next business on Google. Describe what their own AI receptionist would sound like answering with their business name, booking appointments at 2am. Their custom proposal is attached. CTA: reply to hear a live demo built for their business.
3. ACE INVITE. Short, low pressure. Our AI assistant ACE can answer any question about how this works, pricing, and setup, right now, no scheduling. Include this exact link as a markdown link: [Talk to ACE](${aceLink}). Mention this is the last email we will send.

Rules:
- Write as a real person, warm and direct. No hype words. No exclamation marks.
- Never use em dashes or hyphens as sentence breaks.
- Each email body: 4 to 7 short paragraphs of 1 to 3 sentences. Plain text with markdown links only.
- Subjects: under 60 characters, specific to the business, no clickbait.
- Do not invent facts about the business beyond what is provided above.

Return JSON:
{
  "emails": [
    {"n": 1, "subject": "", "body_md": ""},
    {"n": 2, "subject": "", "body_md": ""},
    {"n": 3, "subject": "", "body_md": ""}
  ]
}`,
    }],
  });

  meter?.addClaude(msg.usage);
  const text = (msg.content[0] as { text: string }).text.trim()
    .replace(/^```json?\n?/, "").replace(/```$/, "");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude returned non-JSON email sequence");
  const parsed = JSON.parse(jsonMatch[0]) as { emails: Array<{ n: number; subject: string; body_md: string }> };

  if (!Array.isArray(parsed.emails) || parsed.emails.length !== 3) {
    throw new Error("Email sequence did not contain exactly 3 emails");
  }

  const offsets: Record<number, number> = { 1: 0, 2: 2, 3: 5 };
  return parsed.emails.map((e) => ({
    n: e.n as 1 | 2 | 3,
    subject: String(e.subject ?? "").slice(0, 120),
    body_md: String(e.body_md ?? ""),
    send_offset_days: offsets[e.n] ?? 0,
  }));
}
