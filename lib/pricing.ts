// Single source of truth for Simporic's AI Receptionist pricing. Previously
// duplicated as literal numbers in 4 places (lib/email/templates.ts x2,
// lib/enrichment/proposal.ts, lib/enrichment/emails.ts) with no shared
// constant — a price change meant hand-editing all 4, and missing one let
// the proposal, the outreach emails, and the pricing callout disagree with
// each other in the same send sequence.

export const PRICING = {
  standard: { setup: 497, monthly: 297 },
  managed: { setup: 997, monthly: 997 },
} as const;

export const standardLine = `$${PRICING.standard.setup} setup, $${PRICING.standard.monthly}/month`;
export const managedLine = `$${PRICING.managed.setup} setup, $${PRICING.managed.monthly}/month`;
