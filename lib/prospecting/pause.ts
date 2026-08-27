// ============================================================================
// PROSPECTING PAUSED — 2026-08-01. DO NOT RE-ENABLE WITHOUT READING THIS.
//
// Resend's Acceptable Use Policy (resend.com/legal/acceptable-use), verbatim:
//   "You are prohibited from sending unsolicited messages of any kind,
//    including cold outreach, purchased lists, or scraped contact data."
//   "All mail must be sent to recipients who have explicitly opted in..."
//
// Prospecting's leads come from Google Places search -- no opt-in exists.
// That's a direct, unambiguous ToS violation on the SAME Resend account that
// also sends proposals, review requests, and weekly client reports. Resend's
// ToS permits immediate suspension without notice, "for any reason
// whatsoever" -- a suspension triggered by prospecting traffic would take
// down that legitimate traffic too.
//
// Single source of truth, checked at both entry points:
//   - lib/prospecting/sendOutreach.ts -- blocks the actual send
//   - app/api/prospecting/batches/route.ts -- blocks creating new batches
//     (which spends on Places API and drives the enrichment pipeline that
//     pings Telegram, so there's no point spending/running/alerting toward
//     a send that will never happen)
//
// Re-enabling this requires moving prospecting sends to infrastructure built
// for cold outreach (e.g. Instantly, Smartlead) -- NOT just flipping this
// flag back. Proposals/reviews/reports are unaffected; they live in separate
// FROM constants in app/api/send-proposal/route.ts and
// app/api/reviews/request/route.ts.
// ============================================================================
export const PROSPECTING_PAUSED = true;
