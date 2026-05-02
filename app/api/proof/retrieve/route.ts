import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase client ──────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

// ─── Objection classifier ─────────────────────────────────────────────────────
const OBJECTION_MAP: Record<string, string[]> = {
  too_expensive:     ["expensive","price","cost","afford","budget","too much","cheap","worth","pay","investment"],
  not_sure_it_works: ["works","proven","results","evidence","guarantee","sure","know","proof","confident"],
  no_time:           ["time","busy","schedule","right now","later","hectic","month","week"],
  need_spouse:       ["spouse","partner","wife","husband","together","family","discuss","talk to"],
  trust:             ["trust","real","legit","scam","skeptic","reputation","who are you"],
  comparing_options: ["compare","option","alternative","others","shopping","versus","difference"],
  prior_failure:     ["tried","before","failed","didn't work","waste","last time","previous"],
  fit:               ["like me","my industry","my situation","applies","relevant","specific"],
  low_commitment:    ["info","brochure","think about","send me","follow up","not ready"],
};

function classifyObjection(text: string): string {
  const lower = text.toLowerCase();
  // Score every category by number of keyword hits, return the one with the most.
  // First-match-wins caused ambiguous phrases ("know", "sure", "later") to fire
  // the wrong category when a more specific category had more total matches.
  let bestType = "general";
  let bestScore = 0;
  for (const [type, keywords] of Object.entries(OBJECTION_MAP)) {
    const score = keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }
  return bestType;
}

function detectOffer(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("techup") || lower.includes("ai course") || lower.includes("ai program")) return "techup";
  if (lower.includes("strategy") || lower.includes("consulting") || lower.includes("f10")) return "f10_strategy";
  return "general";
}

// ─── POST /api/proof/retrieve ─────────────────────────────────────────────────
// Called by ACE's ElevenLabs tool webhook mid-conversation.
// Body: { visitor_message, session_id?, persona? }
export async function POST(req: NextRequest) {
  const { visitor_message, session_id, persona } = await req.json();

  if (!visitor_message) {
    return NextResponse.json({ error: "visitor_message required" }, { status: 400 });
  }

  const objection_type = classifyObjection(visitor_message);
  const offer_context  = detectOffer(visitor_message);
  const supabase       = getSupabase();

  // Match on objection tag, prefer strongest claims, prefer offer-matched proof
  const { data, error } = await supabase
    .from("ace_proof_assets")
    .select("id, type, proof_text, claim_strength, asset_url, offer")
    .eq("active", true)
    .eq("permission_status", "approved")
    .contains("objections", [objection_type])
    .limit(5);

  if (error) {
    console.error("[proof/retrieve] Supabase error:", error);
    return NextResponse.json({ error: "Retrieval failed" }, { status: 500 });
  }

  const claimRank: Record<string, number> = { quantified: 3, specific: 2, soft: 1 };

  const ranked = (data ?? []).sort((a, b) => {
    const offerBoost = (x: typeof a) => (x.offer === offer_context ? 10 : 0);
    return (claimRank[b.claim_strength] + offerBoost(b)) -
           (claimRank[a.claim_strength] + offerBoost(a));
  });

  const best = ranked[0] ?? null;

  // Log the retrieval (non-blocking — fire and forget)
  if (best) {
    void (async () => {
      try {
        await supabase.from("ace_proof_retrievals").insert({
          proof_asset_id: best.id,
          objection_raw:  visitor_message,
          objection_type,
          persona_guess:  persona ?? null,
          offer_context,
          session_id:     session_id ?? null,
          converted:      null,
        });
      } catch { /* non-fatal */ }
    })();
  }

  if (!best) {
    return NextResponse.json({ found: false, objection_type, proof_text: null });
  }

  return NextResponse.json({
    found:          true,
    objection_type,
    offer_context,
    type:           best.type,
    claim_strength: best.claim_strength,
    proof_text:     best.proof_text,
    asset_url:      best.asset_url ?? null,
  });
}
