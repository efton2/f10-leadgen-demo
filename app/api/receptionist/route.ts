import { NextRequest, NextResponse } from "next/server";

// ─── PROTECTED AGENTS ────────────────────────────────────────────────────────
// These IDs must NEVER be modified, patched, deleted, or reused by this app.
const PROTECTED_AGENT_IDS: string[] = [
  "agent_8801kq9e2w48f5k83tyt8hqkh4gs", // ACE — F10 Strategy sales closer
];

function isProtected(id: string | undefined | null): boolean {
  if (!id) return false;
  return PROTECTED_AGENT_IDS.includes(id.trim());
}

// ─── RECEPTIONIST VOICE ──────────────────────────────────────────────────────
// The voice every demo receptionist speaks in. Defaults to the ElevenLabs
// premade stock voice "Sarah" (warm, professional female). Override with the
// RECEPTIONIST_VOICE_ID env var if you want a different library voice — but
// never point this at a cloned/personal voice.
const DEFAULT_RECEPTIONIST_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // "Sarah" (stock)
const RECEPTIONIST_VOICE_ID =
  process.env.RECEPTIONIST_VOICE_ID || DEFAULT_RECEPTIONIST_VOICE_ID;

// ─── SELF-CLEANING SWEEP ─────────────────────────────────────────────────────
// Runs in the background on every tap. Lists all ElevenLabs agents, deletes any
// named "Receptionist —" that are older than CLEANUP_AFTER_MS. Non-blocking —
// the user never waits for this.
const CLEANUP_PREFIX = "Receptionist —";
const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

async function sweepOldReceptionists(apiKey: string): Promise<void> {
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
      if (isProtected(a.agent_id)) return false; // never touch protected agents
      if (!a.created_at_unix_secs) return false;  // skip if no timestamp
      return a.created_at_unix_secs * 1000 < cutoff;
    });

    await Promise.allSettled(
      stale.map((a: { agent_id: string; name: string }) =>
        fetch(`https://api.elevenlabs.io/v1/convai/agents/${a.agent_id}`, {
          method: "DELETE",
          headers: { "xi-api-key": apiKey },
        }).then(() => console.log(`[receptionist] Swept stale agent: ${a.name} (${a.agent_id})`))
      )
    );
  } catch (err) {
    // Sweep failures are non-fatal — log and move on.
    console.warn("[receptionist] Sweep error (non-fatal):", err);
  }
}

// ─── NAME CLEANER ─────────────────────────────────────────────────────────────
// Google Places often returns business names with a doctor or owner appended
// after a colon, e.g. "San Antonio Cosmetic Surgery: Delio Ortegon MD, FACS".
// The agent should only ever speak the business name — never the person's name.
//
// Rule: split on ": " and take only the first segment, trimmed.
// Examples:
//   "San Antonio Cosmetic Surgery: Delio Ortegon MD, FACS" → "San Antonio Cosmetic Surgery"
//   "Smith Family Dental: Dr. Jane Smith" → "Smith Family Dental"
//   "Joe's Pizza" → "Joe's Pizza" (unchanged — no colon)
function cleanBusinessName(raw: string): string {
  return raw.split(": ")[0].trim();
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { name: rawName, niche } = await req.json();
  const name = cleanBusinessName(rawName);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }

  // Hard stop: refuse if env var was accidentally pointed at a protected agent.
  const legacyId = process.env.ELEVENLABS_AGENT_ID;
  if (isProtected(legacyId)) {
    console.error(
      `[receptionist] ELEVENLABS_AGENT_ID (${legacyId}) is a protected agent. Request blocked.`
    );
    return NextResponse.json(
      {
        error:
          "Configuration error: ELEVENLABS_AGENT_ID points to a protected agent. " +
          "Remove it — the receptionist route creates fresh agents automatically.",
      },
      { status: 500 }
    );
  }

  // ── Background sweep (non-blocking) ────────────────────────────────────────
  // Fire and forget — don't await, don't let it slow down the user.
  sweepOldReceptionists(apiKey).catch(() => {});

  // ── Create a brand-new agent for this session ───────────────────────────────
  const createRes = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `${CLEANUP_PREFIX} ${name}`,
      conversation_config: {
        agent: {
          prompt: {
            prompt:
              `You are the friendly, professional AI receptionist for ${name}, ` +
              `a ${niche ?? "local business"}. ` +
              "Greet callers warmly, answer general questions about the business, " +
              "take messages when needed, and make every caller feel welcomed and helped.",
          },
          first_message: `Thank you for calling ${name}. How can I help you today?`,
          language: "en",
        },
        tts: {
          // ElevenLabs premade stock voice "Sarah" — warm, professional female.
          // This is a generic library voice, NOT a cloned/personal voice. Keep it
          // a stock voice so demo receptionists never speak in someone's real voice.
          voice_id: RECEPTIONIST_VOICE_ID,
        },
      },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    console.error("[receptionist] Agent creation failed:", createRes.status, body);
    return NextResponse.json({ error: "Failed to create receptionist agent" }, { status: 502 });
  }

  const { agent_id: freshAgentId } = await createRes.json();

  // Sanity check — belt-and-suspenders.
  if (isProtected(freshAgentId)) {
    console.error("[receptionist] ElevenLabs returned a protected agent ID — aborting.");
    return NextResponse.json(
      { error: "Internal error: received a protected agent ID" },
      { status: 500 }
    );
  }

  // ── Get a signed URL for the fresh agent ───────────────────────────────────
  const signedRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${freshAgentId}`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (signedRes.ok) {
    const { signed_url } = await signedRes.json();
    return NextResponse.json({ signedUrl: signed_url, name });
  }

  // Fallback: return the fresh agent ID directly.
  return NextResponse.json({ agentId: freshAgentId, name });
}
