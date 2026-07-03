// Cost constants + usage metering for the prospecting engine.
//
// PRICE SOURCES (edit here if providers change pricing):
// - Google Places: https://developers.google.com/maps/billing-and-pricing/pricing
//   Text Search $32/1000 req, Place Details $17/1000 req
// - Anthropic claude-sonnet: https://www.anthropic.com/pricing ($3/M input, $15/M output)
// - Apify: approximate per-run averages observed on this account
//   (website-content-crawler cheerio ~5 pages, google-maps-scraper per place)

export const COSTS = {
  placesTextSearch: 0.032, // per request (returns up to 20 results)
  placesDetails: 0.017, // per lead
  claudeInPerMTok: 3.0,
  claudeOutPerMTok: 15.0,
  apifyCrawlerRun: 0.03, // website-content-crawler, cheerio, <=5 pages
  apifyMapsPerPlace: 0.02, // google-maps-scraper
};

// Estimated Claude token budgets per enrichment step (input, output)
const STEP_TOKENS = {
  snapshot: [900, 200],
  audit: [4500, 1800],
  competitiveLite: [3000, 1500],
  competitiveFull: [8000, 2000],
  proposal: [1500, 900],
  emails: [2000, 1200],
} as const;

function claudeCost(inTok: number, outTok: number): number {
  return (inTok / 1_000_000) * COSTS.claudeInPerMTok + (outTok / 1_000_000) * COSTS.claudeOutPerMTok;
}

export interface BatchEstimate {
  places: number;
  claude: number;
  apify: number;
  total: number;
  perLead: number;
}

export function estimateBatchCost(opts: { count: number; depth: "lite" | "full" }): BatchEstimate {
  const { count, depth } = opts;

  // Places: 1 textsearch per 20 results + details per lead
  const places = Math.ceil(count / 20) * COSTS.placesTextSearch + count * COSTS.placesDetails;

  // Claude per lead: snapshot + audit + competitive + proposal + emails
  const compKey = depth === "full" ? "competitiveFull" : "competitiveLite";
  const perLeadClaude =
    claudeCost(STEP_TOKENS.snapshot[0], STEP_TOKENS.snapshot[1]) +
    claudeCost(STEP_TOKENS.audit[0], STEP_TOKENS.audit[1]) +
    claudeCost(STEP_TOKENS[compKey][0], STEP_TOKENS[compKey][1]) +
    claudeCost(STEP_TOKENS.proposal[0], STEP_TOKENS.proposal[1]) +
    claudeCost(STEP_TOKENS.emails[0], STEP_TOKENS.emails[1]);
  const claude = perLeadClaude * count;

  // Apify: audit fallback fires on ~30% of sites (direct fetch blocked).
  // Full depth adds ~3 maps lookups + 3 competitor site crawls per lead.
  let perLeadApify = 0.3 * COSTS.apifyCrawlerRun;
  if (depth === "full") {
    perLeadApify += 3 * COSTS.apifyMapsPerPlace + 3 * COSTS.apifyCrawlerRun;
  }
  const apify = perLeadApify * count;

  const total = places + claude + apify;
  return {
    places: round(places),
    claude: round(claude),
    apify: round(apify),
    total: round(total),
    perLead: round(total / Math.max(count, 1)),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface UsageSnapshot {
  claude_in_tokens: number;
  claude_out_tokens: number;
  apify_usd: number;
  places_calls: number;
  cost_usd: number;
}

// Collects actual usage across enrichment steps. Pass one meter through a
// step's calls, then read .toJSON() / .costUsd and roll into lead + batch.
export class UsageMeter {
  claudeIn = 0;
  claudeOut = 0;
  apifyUsd = 0;
  placesCalls = 0;

  addClaude(usage: { input_tokens: number; output_tokens: number } | undefined | null) {
    if (!usage) return;
    this.claudeIn += usage.input_tokens ?? 0;
    this.claudeOut += usage.output_tokens ?? 0;
  }

  addApify(usd: number | undefined | null) {
    if (typeof usd === "number" && usd > 0) this.apifyUsd += usd;
  }

  addPlaces(calls = 1) {
    this.placesCalls += calls;
  }

  get costUsd(): number {
    return round(
      claudeCost(this.claudeIn, this.claudeOut) +
        this.apifyUsd +
        this.placesCalls * COSTS.placesDetails
    );
  }

  toJSON(): UsageSnapshot {
    return {
      claude_in_tokens: this.claudeIn,
      claude_out_tokens: this.claudeOut,
      apify_usd: round(this.apifyUsd),
      places_calls: this.placesCalls,
      cost_usd: this.costUsd,
    };
  }
}

// Merge a step's usage snapshot into an accumulated one (lead- or batch-level JSONB)
export function mergeUsage(base: Partial<UsageSnapshot> | null | undefined, add: UsageSnapshot): UsageSnapshot {
  return {
    claude_in_tokens: (base?.claude_in_tokens ?? 0) + add.claude_in_tokens,
    claude_out_tokens: (base?.claude_out_tokens ?? 0) + add.claude_out_tokens,
    apify_usd: round((base?.apify_usd ?? 0) + add.apify_usd),
    places_calls: (base?.places_calls ?? 0) + add.places_calls,
    cost_usd: round((base?.cost_usd ?? 0) + add.cost_usd),
  };
}
