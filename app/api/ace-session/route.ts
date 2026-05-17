import { NextRequest, NextResponse } from "next/server";

// ─── PROTECTED AGENTS ────────────────────────────────────────────────────────
const PROTECTED_AGENT_IDS: string[] = [
  "agent_8801kq9e2w48f5k83tyt8hqkh4gs", // ACE — F10 Strategy base closer (never modify)
];

function isProtected(id: string | undefined | null): boolean {
  if (!id) return false;
  return PROTECTED_AGENT_IDS.includes(id.trim());
}

// ─── SELF-CLEANING SWEEP ─────────────────────────────────────────────────────
const CLEANUP_PREFIX = "ACE Session —";
const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

async function sweepOldSessions(apiKey: string): Promise<void> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) return;

    const { agents } = await res.json();
    if (!Array.isArray(agents)) return;

    const cutoff = Date.now() - CLEANUP_AFTER_MS;

    const stale = agents.filter((a: { agent_id: string; name: string; created_at_unix_secs?: number }) => {
      if (!a.name?.startsWith(CLEANUP_PREFIX)) return false;
      if (isProtected(a.agent_id)) return false;
      if (!a.created_at_unix_secs) return false;
      return a.created_at_unix_secs * 1000 < cutoff;
    });

    await Promise.allSettled(
      stale.map((a: { agent_id: string; name: string }) =>
        fetch(`https://api.elevenlabs.io/v1/convai/agents/${a.agent_id}`, {
          method: "DELETE",
          headers: { "xi-api-key": apiKey },
        }).then(() => console.log(`[ace-session] Swept stale agent: ${a.name} (${a.agent_id})`))
      )
    );
  } catch (err) {
    console.warn("[ace-session] Sweep error (non-fatal):", err);
  }
}

// ─── HTML STRIPPER ────────────────────────────────────────────────────────────
// Pulls readable text out of the competitive analysis report HTML.
// Strips styles, scripts, and all tags — leaves the actual intelligence.
function extractReportText(html: string, maxChars = 3000): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { client_name, niche, competitors, report_html } = await req.json();

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }

  // Build the competitive context for the system prompt
  const competitorList = Array.isArray(competitors) && competitors.length > 0
    ? competitors.join(", ")
    : "local competitors";

  const competitorContext = report_html
    ? extractReportText(report_html)
    : `${client_name} competes in the ${niche} market against ${competitorList}.`;

  const systemPrompt = `You are ACE, an AI sales closer working for F10 Strategy / AOS (AI Operator Systems). You are speaking directly with the owner or decision maker of ${client_name}, a ${niche} business.

Your mission: close the deal on an AI Operator System implementation. AOS automates lead intake, appointment scheduling, follow-up, and customer communications — removing the manual work that costs this business revenue every day.

COMPETITIVE INTELLIGENCE — ${client_name}'s market (${niche}):
${competitorContext}

USE THIS INTELLIGENCE ACTIVELY in the conversation:
- Reference specific competitors by name when it strengthens your point
- Highlight gaps their competitors have that AOS solves (no online booking, no lead automation, no instant response)
- Frame urgency: their market window is open now — waiting means competitors close it

OBJECTION HANDLING:
- "Too expensive" → Ask what it costs them when a lead calls after hours and no one answers. Then calculate the math together.
- "Not ready" → Ask what ready looks like. Get a specific date. "What would have to be true in 90 days?"
- "Need to think about it" → Ask what the one thing is that they need to think through. Solve it on the call.
- "Already have a system" → Ask what it does automatically without them touching it. Most systems require manual work — AOS does not.
- "Busy right now" → "That's exactly why this conversation matters. AOS removes the busy."

Be confident, specific, and direct. You already know their market. You are the closer. First message: greet them by business name and open with one sharp insight from the competitive data.`;

  // Background sweep — non-blocking
  sweepOldSessions(apiKey).catch(() => {});

  // Create a fresh, context-loaded ACE agent for this session
  const createRes = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `${CLEANUP_PREFIX} ${client_name}`,
      conversation_config: {
        agent: {
          prompt: { prompt: systemPrompt },
          first_message: `I've been looking at your market in ${niche}. You've got a real window right now — want me to show you exactly where your competitors are exposed?`,
          language: "en",
        },
        tts: {
          voice_id: "ZT9u07TYPVl83ejeLakq",
        },
      },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    console.error("[ace-session] Agent creation failed:", createRes.status, body);
    return NextResponse.json({ error: "Failed to create ACE session" }, { status: 502 });
  }

  const { agent_id: freshAgentId } = await createRes.json();

  if (isProtected(freshAgentId)) {
    console.error("[ace-session] ElevenLabs returned a protected agent ID — aborting.");
    return NextResponse.json({ error: "Internal error: received a protected agent ID" }, { status: 500 });
  }

  // Get signed URL for the fresh agent
  const signedRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${freshAgentId}`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (signedRes.ok) {
    const { signed_url } = await signedRes.json();
    return NextResponse.json({ signedUrl: signed_url, clientName: client_name });
  }

  return NextResponse.json({ agentId: freshAgentId, clientName: client_name });
}
