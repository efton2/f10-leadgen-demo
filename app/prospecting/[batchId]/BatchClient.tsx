"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface OutreachEmail {
  n: number;
  subject: string;
  body_md: string;
  send_offset_days: number;
}

interface ProspectingLead {
  id: string;
  place_id: string;
  business_name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  review_count: number;
  category: string;
  contact_email: string;
  email_source: string;
  status: string;
  error: string;
  audit_score: number | null;
  proposal_md: string | null;
  emails: OutreachEmail[] | null;
  cost_usd: number;
}

interface Batch {
  id: string;
  niche: string;
  city: string;
  requested_count: number;
  competitive_depth: string;
  status: string;
  est_cost_usd: number;
  actual_cost_usd: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  details_done: "Details",
  audited: "Audited",
  competitive_done: "Intel",
  proposal_done: "Proposal",
  ready: "Ready",
  approved: "Approved",
  sent: "Sent",
  rejected: "Rejected",
  skipped_duplicate: "Duplicate",
  failed: "Failed",
};

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-gray-100 text-gray-600",
  details_done: "bg-blue-100 text-blue-700",
  audited: "bg-indigo-100 text-indigo-700",
  competitive_done: "bg-purple-100 text-purple-700",
  proposal_done: "bg-violet-100 text-violet-700",
  ready: "bg-green-100 text-green-700",
  approved: "bg-emerald-100 text-emerald-700",
  sent: "bg-teal-100 text-teal-700",
  rejected: "bg-gray-200 text-gray-500",
  skipped_duplicate: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

const WORKING_STATUSES = ["queued", "details_done", "audited", "competitive_done", "proposal_done"];

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 55) return "text-amber-600";
  return "text-red-600";
}

export default function BatchClient({
  initialBatch,
  initialLeads,
}: {
  initialBatch: Batch;
  initialLeads: ProspectingLead[];
}) {
  const [batch, setBatch] = useState(initialBatch);
  const [leads, setLeads] = useState(initialLeads);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // lead id currently approving/rejecting
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const tickRunning = useRef(false);
  const stopped = useRef(false);

  const workingCount = leads.filter((l) => WORKING_STATUSES.includes(l.status)).length;

  // ── Tick loop: while enrichment work remains, keep the runner fed ──────────
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/prospecting/batches/${batch.id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.batch) setBatch(data.batch);
      if (data.leads) {
        setLeads((prev) =>
          prev.map((p) => {
            const fresh = data.leads.find((f: ProspectingLead) => f.id === p.id);
            return fresh ? { ...p, ...fresh } : p;
          })
        );
      }
    } catch {
      /* transient poll failure is fine */
    }
  }, [batch.id]);

  useEffect(() => {
    stopped.current = false;
    async function loop() {
      if (tickRunning.current) return;
      tickRunning.current = true;
      while (!stopped.current) {
        const stillWorking = await fetch("/api/prospecting/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId: batch.id }),
        })
          .then(async (res) => {
            if (!res.ok) return false;
            const data = await res.json();
            await refresh();
            return (data.remaining ?? 0) > 0;
          })
          .catch(() => false);
        if (!stillWorking) break;
      }
      tickRunning.current = false;
    }
    if (workingCount > 0) loop();
    return () => {
      stopped.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  async function patchLead(id: string, updates: Partial<ProspectingLead>) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    const res = await fetch(`/api/prospecting/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save");
      await refresh();
    }
  }

  async function approveLead(lead: ProspectingLead) {
    if (!lead.contact_email) {
      setError("No email on this lead. Add one first.");
      return;
    }
    const ok = window.confirm(
      `Send outreach to ${lead.contact_email}?\n\nEmail 1 (audit report) sends immediately.\nEmail 2 (proposal) schedules +2 days.\nEmail 3 (ACE link) schedules +5 days.`
    );
    if (!ok) return;
    setBusy(lead.id);
    setError("");
    try {
      const res = await fetch(`/api/prospecting/leads/${lead.id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Approve failed (${res.status})`);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "sent" } : l)));
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function rejectLead(lead: ProspectingLead) {
    setBusy(lead.id);
    await patchLead(lead.id, { status: "rejected" });
    setBusy(null);
  }

  function viewArtifact(leadId: string, type: "audit" | "competitive") {
    window.open(`/api/prospecting/leads/${leadId}/artifact?type=${type}`, "_blank");
  }

  function updateEmailDraft(lead: ProspectingLead, n: number, field: "subject" | "body_md", value: string) {
    const emails = (lead.emails ?? []).map((e) => (e.n === n ? { ...e, [field]: value } : e));
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, emails } : l)));
  }

  async function saveEmails(lead: ProspectingLead) {
    setSavingEmail(lead.id);
    await patchLead(lead.id, { emails: lead.emails });
    setSavingEmail(null);
  }

  // ── Counts for header ──────────────────────────────────────────────────────
  const readyCount = leads.filter((l) => l.status === "ready").length;
  const sentCount = leads.filter((l) => l.status === "sent" || l.status === "approved").length;
  const failedCount = leads.filter((l) => l.status === "failed").length;
  const noEmailReady = leads.filter((l) => l.status === "ready" && !l.contact_email).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-f10-text mb-1">
          {batch.niche} · {batch.city}
        </h1>
        <p className="font-body text-sm text-gray-400">
          {leads.length} leads · {batch.competitive_depth} intel · est ${Number(batch.est_cost_usd ?? 0).toFixed(2)}
          {Number(batch.actual_cost_usd ?? 0) > 0 && <> → actual ${Number(batch.actual_cost_usd).toFixed(2)}</>}
        </p>
      </div>

      {/* Progress banner */}
      {workingCount > 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-f10 px-5 py-3 mb-6 flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <p className="font-body text-sm text-blue-800">
            Enriching {workingCount} lead{workingCount === 1 ? "" : "s"}. Keep this page open — it drives the
            processing. {readyCount > 0 && `${readyCount} already ready for review below.`}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-f10 px-5 py-3 mb-6">
          <p className="font-body text-sm text-gray-600">
            <span className="font-semibold text-green-700">{readyCount} ready for review</span>
            {sentCount > 0 && <> · {sentCount} sent</>}
            {failedCount > 0 && <> · <span className="text-red-600">{failedCount} failed</span></>}
            {noEmailReady > 0 && <> · <span className="text-amber-600">{noEmailReady} missing email</span></>}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-f10 px-5 py-3 mb-6">
          <p className="font-body text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Lead table */}
      <div className="bg-white rounded-f10 border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-f10-tint border-b border-gray-100">
              <th className="text-left font-body text-xs font-semibold text-f10-text uppercase tracking-wide px-6 py-3">Business</th>
              <th className="text-left font-body text-xs font-semibold text-f10-text uppercase tracking-wide px-4 py-3">Score</th>
              <th className="text-left font-body text-xs font-semibold text-f10-text uppercase tracking-wide px-4 py-3">Email</th>
              <th className="text-left font-body text-xs font-semibold text-f10-text uppercase tracking-wide px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                expanded={expanded === lead.id}
                busy={busy === lead.id}
                savingEmail={savingEmail === lead.id}
                onToggle={() => setExpanded(expanded === lead.id ? null : lead.id)}
                onApprove={() => approveLead(lead)}
                onReject={() => rejectLead(lead)}
                onEmailChange={(email) => patchLead(lead.id, { contact_email: email, email_source: "manual" })}
                onViewArtifact={(type) => viewArtifact(lead.id, type)}
                onProposalChange={(md) => setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, proposal_md: md } : l)))}
                onProposalSave={() => patchLead(lead.id, { proposal_md: lead.proposal_md })}
                onDraftChange={(n, field, value) => updateEmailDraft(lead, n, field, value)}
                onDraftsSave={() => saveEmails(lead)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  expanded,
  busy,
  savingEmail,
  onToggle,
  onApprove,
  onReject,
  onEmailChange,
  onViewArtifact,
  onProposalChange,
  onProposalSave,
  onDraftChange,
  onDraftsSave,
}: {
  lead: ProspectingLead;
  expanded: boolean;
  busy: boolean;
  savingEmail: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEmailChange: (email: string) => void;
  onViewArtifact: (type: "audit" | "competitive") => void;
  onProposalChange: (md: string) => void;
  onProposalSave: () => void;
  onDraftChange: (n: number, field: "subject" | "body_md", value: string) => void;
  onDraftsSave: () => void;
}) {
  const [emailDraft, setEmailDraft] = useState(lead.contact_email);
  useEffect(() => setEmailDraft(lead.contact_email), [lead.contact_email]);

  const reviewable = lead.status === "ready";
  const canExpand = ["ready", "approved", "sent", "rejected", "failed"].includes(lead.status) && lead.proposal_md;

  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4">
          <a
            href={`/lead/${lead.place_id}?niche=${encodeURIComponent(lead.category)}`}
            target="_blank"
            className="font-body text-sm font-semibold text-gray-900 hover:text-f10-primary"
          >
            {lead.business_name}
          </a>
          <div className="font-body text-xs text-gray-400">
            {lead.rating > 0 && <>{lead.rating}★ ({lead.review_count}) · </>}
            {lead.address.split(",")[0]}
          </div>
          {lead.status === "failed" && lead.error && (
            <div className="font-body text-xs text-red-500 mt-1 max-w-md truncate" title={lead.error}>
              {lead.error}
            </div>
          )}
        </td>
        <td className="px-4 py-4">
          {lead.audit_score != null ? (
            <span className={`font-body text-sm font-bold ${scoreColor(lead.audit_score)}`}>{lead.audit_score}</span>
          ) : (
            <span className="font-body text-sm text-gray-300">—</span>
          )}
        </td>
        <td className="px-4 py-4">
          {reviewable && !lead.contact_email ? (
            <div className="flex items-center gap-2">
              <span className="inline-block font-body text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                No email
              </span>
              <input
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                onBlur={() => emailDraft.trim() && onEmailChange(emailDraft.trim())}
                placeholder="add manually"
                className="border border-gray-200 rounded px-2 py-1 font-body text-xs text-gray-900 w-44 focus:outline-none focus:border-f10-primary"
              />
            </div>
          ) : (
            <span className="font-body text-xs text-gray-600">
              {lead.contact_email || <span className="text-gray-300">—</span>}
              {lead.email_source === "scraped" && lead.contact_email && (
                <span className="text-gray-400"> (scraped)</span>
              )}
            </span>
          )}
        </td>
        <td className="px-4 py-4">
          <span
            className={`inline-block font-body text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-500"}`}
          >
            {STATUS_LABELS[lead.status] ?? lead.status}
          </span>
        </td>
        <td className="px-4 py-4 text-right whitespace-nowrap">
          {canExpand && (
            <button
              onClick={onToggle}
              className="font-body text-xs font-semibold text-f10-primary hover:underline"
            >
              {expanded ? "Close" : "Review"}
            </button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={5} className="px-6 py-6">
            <div className="space-y-6 max-w-4xl">
              {/* Reports */}
              <div className="flex gap-3">
                <button
                  onClick={() => onViewArtifact("audit")}
                  className="border border-gray-300 bg-white font-body text-xs font-semibold text-gray-700 px-4 py-2 rounded-f10 hover:border-f10-primary hover:text-f10-primary transition-colors"
                >
                  View Audit Report{lead.audit_score != null && ` (${lead.audit_score}/100)`}
                </button>
                <button
                  onClick={() => onViewArtifact("competitive")}
                  className="border border-gray-300 bg-white font-body text-xs font-semibold text-gray-700 px-4 py-2 rounded-f10 hover:border-f10-primary hover:text-f10-primary transition-colors"
                >
                  View Competitive Report
                </button>
              </div>

              {/* Proposal */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-heading text-base text-gray-900">Proposal (attached to email 2)</h3>
                  {reviewable && (
                    <button
                      onClick={onProposalSave}
                      className="font-body text-xs font-semibold text-f10-primary hover:underline"
                    >
                      Save proposal edits
                    </button>
                  )}
                </div>
                <textarea
                  value={lead.proposal_md ?? ""}
                  onChange={(e) => onProposalChange(e.target.value)}
                  readOnly={!reviewable}
                  rows={8}
                  className="w-full border border-gray-200 rounded-f10 px-4 py-3 font-body text-xs text-gray-800 bg-white focus:outline-none focus:border-f10-primary"
                />
              </div>

              {/* Email drafts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-heading text-base text-gray-900">Outreach sequence</h3>
                  {reviewable && (
                    <button
                      onClick={onDraftsSave}
                      disabled={savingEmail}
                      className="font-body text-xs font-semibold text-f10-primary hover:underline disabled:opacity-50"
                    >
                      {savingEmail ? "Saving..." : "Save email edits"}
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {(lead.emails ?? []).map((e) => (
                    <div key={e.n} className="bg-white border border-gray-200 rounded-f10 p-4">
                      <div className="font-body text-xs text-gray-400 mb-2">
                        Email {e.n} ·{" "}
                        {e.send_offset_days === 0 ? "sends immediately on approve" : `+${e.send_offset_days} days`}
                        {e.n === 1 && " · audit report attached"}
                        {e.n === 2 && " · proposal attached"}
                      </div>
                      <input
                        value={e.subject}
                        onChange={(ev) => onDraftChange(e.n, "subject", ev.target.value)}
                        readOnly={!reviewable}
                        className="w-full border border-gray-200 rounded px-3 py-2 font-body text-sm font-semibold text-gray-900 mb-2 focus:outline-none focus:border-f10-primary"
                      />
                      <textarea
                        value={e.body_md}
                        onChange={(ev) => onDraftChange(e.n, "body_md", ev.target.value)}
                        readOnly={!reviewable}
                        rows={6}
                        className="w-full border border-gray-200 rounded px-3 py-2 font-body text-xs text-gray-800 focus:outline-none focus:border-f10-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {reviewable && (
                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={onApprove}
                    disabled={busy || !lead.contact_email}
                    className="bg-f10-primary text-white font-body font-semibold px-6 py-3 rounded-f10 hover:bg-[#C8870A] active:scale-[0.97] transition-[transform,background-color] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? "Sending..." : `Approve & Send to ${lead.contact_email || "(no email)"}`}
                  </button>
                  <button
                    onClick={onReject}
                    disabled={busy}
                    className="border border-gray-300 bg-white font-body font-semibold text-gray-600 px-6 py-3 rounded-f10 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
