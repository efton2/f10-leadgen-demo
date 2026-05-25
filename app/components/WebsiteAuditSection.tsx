"use client";

import { useState, useCallback } from "react";

type StepStatus = "waiting" | "active" | "done";
type AuditStatus = "idle" | "running" | "done" | "error";

const AUDIT_STEPS = [
  { id: "fetch",   label: "Crawling website pages" },
  { id: "analyze", label: "Running AI analysis (5 dimensions)" },
  { id: "score",   label: "Scoring and identifying findings" },
  { id: "build",   label: "Building PDF report" },
];

function StepRow({ label, status }: { label: string; status: StepStatus }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
        status === "done"   ? "bg-green-500" :
        status === "active" ? "bg-amber-400 animate-pulse" :
        "bg-gray-700"
      }`} />
      <span className={`font-body text-sm flex-1 transition-colors duration-300 ${
        status === "done"   ? "text-green-400" :
        status === "active" ? "text-f10-text" :
        "text-gray-600"
      }`}>{label}</span>
      {status === "done" && <span className="font-body text-xs text-green-500">✓</span>}
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 75 ? "text-green-400 border-green-500/40 bg-green-500/10"
              : score >= 55 ? "text-amber-400 border-amber-400/40 bg-amber-400/10"
              : "text-red-400 border-red-400/40 bg-red-400/10";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-body text-sm font-semibold ${color}`}>
      {score}/100
    </span>
  );
}

interface Props {
  businessName: string;
  website: string;
}

export default function WebsiteAuditSection({ businessName, website }: Props) {
  const [status, setStatus]         = useState<AuditStatus>("idle");
  const [steps, setSteps]           = useState<Record<string, StepStatus>>({});
  const [logs, setLogs]             = useState<string[]>([]);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [score, setScore]           = useState<number | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setStatus("running");
    setSteps({});
    setLogs([]);
    setReportHtml(null);
    setScore(null);
    setError(null);

    try {
      const res = await fetch("/api/website-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website, business_name: businessName }),
      });

      if (!res.body) throw new Error("No stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "step") {
              setSteps((prev) => ({ ...prev, [event.step]: event.status }));
            } else if (event.type === "log") {
              setLogs((prev) => [...prev, event.msg]);
            } else if (event.type === "done") {
              setReportHtml(event.html);
              setScore(event.score);
              setStatus("done");
            } else if (event.type === "error") {
              setError(event.msg);
              setStatus("error");
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, [website, businessName]);

  const openReport = useCallback(() => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [reportHtml]);

  const lastLog = logs[logs.length - 1];

  return (
    <div className="bg-f10-tint rounded-f10 border border-f10-border p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="font-heading text-xs tracking-widest uppercase text-f10-primary">Audit</span>
          <h3 className="font-heading text-xl font-semibold text-f10-text">Website Audit</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${
            status === "done"    ? "bg-green-500" :
            status === "running" ? "bg-amber-400 animate-pulse" :
            "bg-gray-300"
          }`} />
          <span className="font-body text-xs text-gray-400">
            {status === "done" ? "Complete" : status === "running" ? "In progress" : "Not started"}
          </span>
        </div>
      </div>

      {/* Idle state */}
      {status === "idle" && (
        <div>
          <p className="font-body text-sm text-gray-400 mb-4 leading-relaxed">
            Audit <span className="text-f10-primary">{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span> across content, conversion, SEO, and trust. Generates a branded PDF report you can send with the proposal.
          </p>
          <button
            onClick={runAudit}
            className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-f10-primary text-white hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Audit Website →
          </button>
        </div>
      )}

      {/* Running state */}
      {status === "running" && (
        <div className="bg-f10-bg rounded-lg p-4 space-y-3">
          {AUDIT_STEPS.map((s) => (
            <StepRow key={s.id} label={s.label} status={steps[s.id] ?? "waiting"} />
          ))}
          {lastLog && (
            <p className="font-body text-xs text-gray-500 pt-1 border-t border-f10-border mt-3">{lastLog}</p>
          )}
        </div>
      )}

      {/* Done state */}
      {status === "done" && reportHtml && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <span className="font-body text-sm text-gray-400">Overall score</span>
            {score !== null && <ScorePill score={score} />}
          </div>
          <div className="flex gap-3">
            <button
              onClick={openReport}
              className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-f10-primary text-white hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Open PDF Report →
            </button>
            <button
              onClick={runAudit}
              className="font-body text-sm px-4 py-2.5 rounded-lg border border-f10-border text-gray-400 hover:text-f10-text hover:border-f10-primary transition-all"
            >
              Re-run
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div>
          <p className="font-body text-sm text-red-400 mb-3">{error ?? "Audit failed."}</p>
          <button
            onClick={runAudit}
            className="font-body text-sm px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
