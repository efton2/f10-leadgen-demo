// lib/meeting-brain.ts
// Workflow #1 — Meeting → follow-up → money. THE BRAIN.
// Takes a raw meeting transcript and returns a structured, review-ready digest:
// recap, action items, deal detection, a style-matched drafted follow-up email,
// and a next-meeting suggestion. Stripe + Calendly execution are layered on top
// of `deal` and `next_meeting` in a later pass — the schema is built for it.
//
// Server-only. Uses the same Anthropic setup as the rest of the app.
import Anthropic from "@anthropic-ai/sdk";

export interface ActionItem {
  owner: "us" | "client" | "shared";
  task: string;
  due: string | null; // ISO date or natural-language ("end of week"); null if none stated
}

export interface DealRead {
  is_deal: boolean;
  stage:
    | "none"
    | "discovery"
    | "proposal"
    | "negotiation"
    | "closing"
    | "closed_won"
    | "closed_lost";
  what_selling: string; // what the client would actually be buying
  suggested_amount: number | null; // in major units (dollars), null if unclear
  currency: string; // ISO 4217, lowercase — defaults to "usd"
  confidence: "low" | "medium" | "high";
  rationale: string; // why the brain read it this way — keeps the human in control
}

export interface NextMeeting {
  recommended: boolean;
  purpose: string;
  suggested_duration_minutes: number | null;
  proposed_agenda: string[];
}

export interface FollowUpEmail {
  subject: string;
  body: string; // plain text, ready to drop into Gmail; no markdown
}

export interface MeetingDigest {
  summary: string; // 2–3 short paragraphs
  key_points: string[];
  action_items: ActionItem[];
  risks: string[]; // objections / blockers / things that could kill the deal
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  deal: DealRead;
  follow_up_email: FollowUpEmail;
  next_meeting: NextMeeting;
}

export interface BrainInput {
  transcript: string;
  title?: string;
  host?: string; // who ran the call (you)
  attendees?: string; // comma-separated
  clientName?: string; // the other side, if known
  /** Optional sample of the host's past emails so the draft matches their voice. */
  styleSample?: string;
}

const MODEL = "claude-sonnet-4-6";

// Matches the JSON-extraction approach used in competitive-analysis/route.ts
function extractJson(text: string): string {
  const trimmed = text.trim().replace(/^```json?\n?/i, "").replace(/```$/i, "").trim();
  // Fall back to the first {...} block if the model wrapped it in prose.
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export async function analyzeMeeting(input: BrainInput): Promise<MeetingDigest> {
  const apiKey = process.env.F10_ANTHROPIC_KEY;
  if (!apiKey) throw new Error("F10_ANTHROPIC_KEY not configured");
  if (!input.transcript || input.transcript.trim().length < 40) {
    throw new Error("Transcript too short to analyze");
  }

  const anthropic = new Anthropic({ apiKey });

  const ctx = [
    input.title ? `Meeting title: ${input.title}` : "",
    input.host ? `Host (our side): ${input.host}` : "",
    input.clientName ? `Client / other party: ${input.clientName}` : "",
    input.attendees ? `Attendees: ${input.attendees}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const styleBlock = input.styleSample
    ? `\n\nMatch the voice, greeting, and sign-off of these past emails from the host. Mirror their tone and formality, not their exact words:\n"""\n${input.styleSample.slice(0, 3000)}\n"""`
    : `\n\nWrite the email in a warm, confident, concise professional voice. Do not use em dashes or hyphens as separators. Short paragraphs. No bullet points in the email body.`;

  const prompt = `You are the chief of staff for the host of this sales/consulting meeting. You just read the full transcript. Produce a single review-ready digest the host can act on in two minutes.

${ctx ? ctx + "\n\n" : ""}TRANSCRIPT:
"""
${input.transcript.slice(0, 60000)}
"""

Think about: what was actually agreed, who owes what, whether this is a real revenue opportunity and roughly how big, what could kill it, and what the very next email should say to move it forward.

Return ONLY valid JSON (no markdown fences, no commentary) with EXACTLY this shape:
{
  "summary": "2 to 3 short paragraphs recapping what happened and where things stand",
  "key_points": ["the handful of things that actually mattered"],
  "action_items": [
    { "owner": "us | client | shared", "task": "specific, concrete", "due": "ISO date or natural-language deadline, or null" }
  ],
  "risks": ["objections, blockers, or hesitations raised that could stall or kill the deal"],
  "sentiment": "positive | neutral | negative | mixed",
  "deal": {
    "is_deal": true,
    "stage": "none | discovery | proposal | negotiation | closing | closed_won | closed_lost",
    "what_selling": "what the client would actually be buying",
    "suggested_amount": 0,
    "currency": "usd",
    "confidence": "low | medium | high",
    "rationale": "one sentence on why you read the deal and amount this way"
  },
  "follow_up_email": {
    "subject": "specific subject line referencing the conversation",
    "body": "the full follow-up email body the host can send, plain text, signed off as the host"
  },
  "next_meeting": {
    "recommended": true,
    "purpose": "why meet again",
    "suggested_duration_minutes": 30,
    "proposed_agenda": ["agenda items for the next call"]
  }
}

Rules:
- If no money was discussed and there is no opportunity, set deal.is_deal=false, deal.stage="none", deal.suggested_amount=null, and confidence="low".
- Never invent a dollar figure that was not implied by the conversation. If unclear, set suggested_amount=null and explain in rationale.
- suggested_amount is a number in major currency units (e.g. 2500 for $2,500), not a string.
- Ground every action item and risk in something actually said in the transcript.
- The email must reflect what was really discussed. Do not promise anything the host did not offer.${styleBlock}`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { text: string }).text;
  let parsed: MeetingDigest;
  try {
    parsed = JSON.parse(extractJson(raw)) as MeetingDigest;
  } catch (err) {
    throw new Error(`Brain returned unparseable JSON: ${String(err)}`);
  }

  return normalize(parsed);
}

// Defensive defaults so downstream code (DB inserts, Stripe step) never hits undefined.
function normalize(d: Partial<MeetingDigest>): MeetingDigest {
  const deal = d.deal ?? ({} as Partial<DealRead>);
  const nm = d.next_meeting ?? ({} as Partial<NextMeeting>);
  const email = d.follow_up_email ?? ({} as Partial<FollowUpEmail>);
  return {
    summary: d.summary ?? "",
    key_points: Array.isArray(d.key_points) ? d.key_points : [],
    action_items: Array.isArray(d.action_items) ? d.action_items : [],
    risks: Array.isArray(d.risks) ? d.risks : [],
    sentiment: d.sentiment ?? "neutral",
    deal: {
      is_deal: Boolean(deal.is_deal),
      stage: deal.stage ?? "none",
      what_selling: deal.what_selling ?? "",
      suggested_amount:
        typeof deal.suggested_amount === "number" ? deal.suggested_amount : null,
      currency: (deal.currency ?? "usd").toLowerCase(),
      confidence: deal.confidence ?? "low",
      rationale: deal.rationale ?? "",
    },
    follow_up_email: {
      subject: email.subject ?? "",
      body: email.body ?? "",
    },
    next_meeting: {
      recommended: Boolean(nm.recommended),
      purpose: nm.purpose ?? "",
      suggested_duration_minutes:
        typeof nm.suggested_duration_minutes === "number"
          ? nm.suggested_duration_minutes
          : null,
      proposed_agenda: Array.isArray(nm.proposed_agenda) ? nm.proposed_agenda : [],
    },
  };
}
