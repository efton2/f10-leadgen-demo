// Auto-queue threshold for the digest path (additive to the manual 'ready'
// review queue, never a replacement for it). Tune AUTO_APPROVE_MIN_SCORE
// here — nothing else needs to change to adjust the bar.
//
// Signal used: audit_score (0-100, already computed for every lead by the
// existing website-audit step). A high score means a weak/thin prospect
// site with clear, defensible findings — the stronger the audit hook, the
// more the outreach reads as genuinely useful rather than generic cold
// spam, which is the confidence proxy this threshold is standing in for.
// This is a starting assumption, not a validated conversion signal — revisit
// once real send/reply data exists.
export const AUTO_APPROVE_MIN_SCORE = 80;

export interface AutoApproveCheckInput {
  auditScore: number | null;
  contactEmail: string;
  emailsGenerated: boolean;
}

export function qualifiesForAutoApprove(lead: AutoApproveCheckInput): boolean {
  if (!lead.contactEmail) return false;
  if (!lead.emailsGenerated) return false;
  if (lead.auditScore == null) return false;
  return lead.auditScore >= AUTO_APPROVE_MIN_SCORE;
}
