"use client";

import { useState, useCallback } from "react";
import ReceptionistOrb from "./ReceptionistOrb";

interface Props {
  name: string;
  niche: string;
  searchNiche?: string;
  phone: string;
  address: string;
}

type AnalysisStatus = "idle" | "running" | "done" | "error";

const BRAND_OPTIONS = [
  { value: "f10_strategy", label: "F10 Strategy", detail: "f10strategy.com" },
  { value: "aos", label: "AI Operator Systems", detail: "aioperatorsystems.com" },
];

function StatusDot({ status }: { status: "idle" | "active" | "done" }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        status === "done"
          ? "bg-green-500"
          : status === "active"
          ? "bg-amber-400 animate-pulse"
          : "bg-gray-300"
      }`}
    />
  );
}

function SectionHeader({
  num, title, status,
}: {
  num: string; title: string; status: "idle" | "active" | "done";
}) {
  const label =
    status === "done" ? "Complete" : status === "active" ? "In progress" : "Not started";
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <span className="font-heading text-xs tracking-widest uppercase text-f10-primary">{num}</span>
        <h3 className="font-heading text-xl font-semibold text-f10-text">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span className="font-body text-xs text-gray-400">{label}</span>
      </div>
    </div>
  );
}

type StepStatus = "waiting" | "active" | "done";
type AnalysisSteps = Record<string, StepStatus>;

const STEPS = [
  { id: "gather", label: "Gathering competitor data" },
  { id: "scrape", label: "Scraping websites" },
  { id: "synthesize", label: "Analyzing with AI" },
  { id: "build", label: "Building report" },
];

function AnalysisProgress({ steps, log }: { steps: AnalysisSteps; log: string[] }) {
  const lastLog = log[log.length - 1];
  return (
    <div className="mt-4 bg-f10-bg rounded-lg p-4 space-y-3">
      {STEPS.map((step) => {
        const status = steps[step.id] ?? "waiting";
        return (
          <div key={step.id} className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
              status === "done" ? "bg-green-500" :
              status === "active" ? "bg-f10-primary animate-pulse" :
              "bg-gray-700"
            }`} />
            <span className={`font-body text-sm flex-1 transition-colors duration-300 ${
              status === "done" ? "text-green-400" :
              status === "active" ? "text-f10-text" :
              "text-gray-600"
            }`}>{step.label}</span>
            {status === "done" && <span className="font-body text-xs text-green-500">✓</span>}
            {status === "active" && <span className="font-body text-xs text-f10-primary animate-pulse">Running</span>}
          </div>
        );
      })}
      {lastLog && (
        <p className="font-mono text-[11px] text-gray-600 pt-1 border-t border-f10-border truncate">
          › {lastLog}
        </p>
      )}
    </div>
  );
}

export default function ProofStack({ name, niche, searchNiche, phone, address }: Props) {
  // ── Competitive Analysis state ──────────────────────────────────────────────
  const city = address.split(",").slice(1, 3).join(",").trim();
  const [brand, setBrand] = useState("f10_strategy");
  const [market, setMarket] = useState(city);
  const [marketDisplay, setMarketDisplay] = useState(city);
  const [competitors, setCompetitors] = useState(["", "", "", "", ""]);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [steps, setSteps] = useState<AnalysisSteps>({});
  const [log, setLog] = useState<string[]>([]);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  // ── Receptionist state ──────────────────────────────────────────────────────
  const [receptionistUsed, setReceptionistUsed] = useState(false);

  // ── ACE state ───────────────────────────────────────────────────────────────
  const [aceCopied, setAceCopied] = useState(false);
  const [aceLoading, setAceLoading] = useState(false);
  const [aceOpened, setAceOpened] = useState(false);

  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [competitorSearchError, setCompetitorSearchError] = useState("");

  const updateCompetitor = (i: number, val: string) => {
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? val : c)));
  };

  const searchCompetitors = useCallback(async () => {
    setLoadingCompetitors(true);
    setCompetitorSearchError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: searchNiche ?? niche, city: market }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const names: string[] = (data.leads ?? []).slice(0, 5).map((l: { name: string }) => l.name);
      if (names.length === 0) {
        setCompetitorSearchError("No results — try editing the Search Market field and searching again.");
      } else {
        setCompetitors([...names, ...Array(5 - names.length).fill("")]);
      }
    } catch {
      setCompetitorSearchError("Search failed — check your connection and try again.");
    } finally {
      setLoadingCompetitors(false);
    }
  }, [niche, searchNiche, market]);

  const openReport = useCallback(() => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [reportHtml]);

  const copyAceLink = () => {
    navigator.clipboard.writeText("https://ace-f10.pages.dev");
    setAceCopied(true);
    setTimeout(() => setAceCopied(false), 2000);
  };

  const openAce = useCallback(async () => {
    // If no competitive data, fall back to the base ACE closer
    if (!reportHtml) {
      window.open("https://ace-f10.pages.dev", "_blank");
      return;
    }

    setAceLoading(true);
    try {
      const res = await fetch("/api/ace-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: name,
          niche,
          competitors: competitors.filter((c) => c.trim().length > 0),
          report_html: reportHtml,
        }),
      });

      if (!res.ok) throw new Error("ace-session failed");

      const data = await res.json();
      const params = new URLSearchParams({ clientName: name });
      if (data.signedUrl) params.set("signedUrl", data.signedUrl);
      else if (data.agentId) params.set("agentId", data.agentId);

      window.open(`/ace-session?${params.toString()}`, "_blank");
      setAceOpened(true);
    } catch (err) {
      console.error("ACE session error:", err);
      window.open("https://ace-f10.pages.dev", "_blank");
    } finally {
      setAceLoading(false);
    }
  }, [reportHtml, name, niche, competitors]);

  const runAnalysis = useCallback(async () => {
    const filtered = competitors.filter((c) => c.trim().length > 0);
    if (!filtered.length) {
      alert("Add at least one competitor name.");
      return;
    }

    setAnalysisStatus("running");
    setSteps({ gather: "active" });
    setLog([]);
    setReportHtml(null);

    try {
      const res = await fetch("/api/competitive-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: name,
          industry: niche,
          market,
          market_display: marketDisplay || market,
          competitors: filtered,
          brand,
        }),
      });

      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "log") {
              setLog((prev) => [...prev, event.msg]);
              const msg: string = event.msg;
              if (msg.startsWith("Scraping ") && msg.includes(" competitors")) {
                setSteps({ gather: "done", scrape: "active" });
              } else if (msg.startsWith("Synthesizing")) {
                setSteps({ gather: "done", scrape: "done", synthesize: "active" });
              } else if (msg.startsWith("Building report")) {
                setSteps({ gather: "done", scrape: "done", synthesize: "done", build: "active" });
              }
            }
            if (event.type === "done") {
              setSteps({ gather: "done", scrape: "done", synthesize: "done", build: "done" });
              setReportHtml(event.html);
              setAnalysisStatus("done");
            }
            if (event.type === "error") {
              setLog((prev) => [...prev, `Error: ${event.msg}`]);
              setAnalysisStatus("error");
            }
          } catch {}
        }
      }
    } catch (err) {
      setLog((prev) => [...prev, `Error: ${String(err)}`]);
      setAnalysisStatus("error");
    }
  }, [name, niche, market, marketDisplay, competitors, brand]);

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-full bg-f10-primary flex items-center justify-center">
          <span className="text-white text-[9px] font-semibold">F10</span>
        </div>
        <h2 className="font-heading text-2xl font-semibold text-f10-text">Praeco</h2>
        <span className="font-body text-xs text-gray-400 bg-f10-tint px-2 py-0.5 rounded-full">
          3-part suite
        </span>
      </div>

      {/* ── 1. Competitive Analysis ── */}
      <div className="bg-f10-tint rounded-f10 border border-f10-border p-6 mb-4 animate-fade-up [animation-delay:0ms]">
        <SectionHeader
          num="01"
          title="Competitive Analysis"
          status={analysisStatus === "idle" ? "idle" : analysisStatus === "done" ? "done" : "active"}
        />

        {/* Brand selector */}
        <div className="flex gap-3 mb-5">
          {BRAND_OPTIONS.map((b) => (
            <button
              key={b.value}
              onClick={() => setBrand(b.value)}
              className={`flex-1 py-3 px-4 rounded-lg border text-left transition-[transform,border-color,background-color] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] duration-200 active:scale-[0.97] ${
                brand === b.value
                  ? "border-f10-primary bg-f10-tint"
                  : "border-f10-border hover:border-gray-300"
              }`}
            >
              <div className={`font-body text-sm font-semibold ${brand === b.value ? "text-f10-primary" : "text-f10-text"}`}>
                {b.label}
              </div>
              <div className="font-body text-xs text-gray-400">{b.detail}</div>
            </button>
          ))}
        </div>

        {/* Market fields */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block font-body text-xs uppercase tracking-wider text-gray-400 mb-1">
              Search Market
            </label>
            <input
              type="text"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="e.g. Miami, FL or 33133"
              className="w-full border border-f10-border bg-f10-bg text-f10-text rounded-lg px-3 py-2 font-body text-sm focus:outline-none focus:border-f10-primary placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="block font-body text-xs uppercase tracking-wider text-gray-400 mb-1">
              Display Market
            </label>
            <input
              type="text"
              value={marketDisplay}
              onChange={(e) => setMarketDisplay(e.target.value)}
              placeholder="e.g. Miami, FL"
              className="w-full border border-f10-border bg-f10-bg text-f10-text rounded-lg px-3 py-2 font-body text-sm focus:outline-none focus:border-f10-primary placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Competitor inputs */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between mb-1">
            <label className="block font-body text-xs uppercase tracking-wider text-gray-400">
              Competitors (up to 5)
            </label>
            <button
              onClick={searchCompetitors}
              disabled={loadingCompetitors || analysisStatus === "running"}
              className="font-body text-xs text-f10-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loadingCompetitors ? "Searching..." : "Search market"}
            </button>
          </div>
          {competitors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-body text-xs text-f10-primary font-semibold w-4">{i + 1}</span>
              <input
                type="text"
                value={c}
                onChange={(e) => updateCompetitor(i, e.target.value)}
                placeholder="Competitor name"
                className="flex-1 border border-f10-border bg-f10-bg text-f10-text rounded-lg px-3 py-2 font-body text-sm focus:outline-none focus:border-f10-primary placeholder:text-gray-600"
              />
            </div>
          ))}
          {competitorSearchError && (
            <p className="font-body text-xs text-amber-400 pt-1">{competitorSearchError}</p>
          )}
        </div>

        {/* Generate button */}
        {analysisStatus !== "done" && (
          <button
            onClick={runAnalysis}
            disabled={analysisStatus === "running"}
            className="w-full py-3 rounded-lg bg-f10-primary text-white font-body text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#C8870A] active:scale-[0.97] transition-[transform,background-color] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] duration-150"
          >
            {analysisStatus === "running" ? "Generating..." : "Generate Report"}
          </button>
        )}

        {/* Progress tracker */}
        {analysisStatus === "running" && (
          <AnalysisProgress steps={steps} log={log} />
        )}

        {/* Result */}
        {analysisStatus === "done" && reportHtml && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={openReport}
              className="flex-1 py-3 rounded-lg bg-f10-primary text-white font-body text-sm font-semibold hover:bg-[#C8870A] active:scale-[0.97] transition-[transform,background-color] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] duration-150"
            >
              View Report
            </button>
            <button
              onClick={runAnalysis}
              className="px-4 py-3 rounded-lg border border-f10-border font-body text-sm text-gray-400 hover:border-f10-primary hover:text-f10-primary active:scale-[0.97] transition-[transform,border-color,color] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] duration-150"
            >
              Regenerate
            </button>
          </div>
        )}
      </div>

      {/* ── 2. AI Receptionist ── */}
      <div className="bg-f10-tint rounded-f10 border border-f10-border p-6 mb-4 animate-fade-up [animation-delay:80ms]">
        <SectionHeader
          num="02"
          title="AI Receptionist Demo"
          status={receptionistUsed ? "done" : "idle"}
        />
        <div onClick={() => setReceptionistUsed(true)}>
          <ReceptionistOrb name={name} niche={niche} phone={phone} />
        </div>
      </div>

      {/* ── 3. ACE Closer ── */}
      <div className="bg-f10-tint rounded-f10 border border-f10-border p-6 animate-fade-up [animation-delay:160ms]">
        <SectionHeader
          num="03"
          title="AI Consultation Expert"
          status={aceOpened || aceCopied ? "done" : "idle"}
        />
        <p className="font-body text-sm text-gray-400 mb-5">
          Launch the AI sales closer. The prospect starts a conversation and ACE handles every objection with the competitive intelligence already loaded.
        </p>
        {reportHtml && (
          <p className="font-body text-xs text-f10-primary bg-f10-tint px-3 py-2 rounded-lg mb-4">
            Competitive intel loaded — ACE will reference {name}&apos;s market data in this session.
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={openAce}
            disabled={aceLoading}
            className="flex-1 py-3 rounded-lg bg-f10-primary text-white font-body text-sm font-semibold hover:bg-[#C8870A] active:scale-[0.97] transition-[transform,background-color] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aceLoading ? "Connecting..." : reportHtml ? "Start Consultation (intel loaded)" : "Start Consultation"}
          </button>
          <button
            onClick={copyAceLink}
            className="px-4 py-3 rounded-lg border border-f10-border font-body text-sm text-gray-400 hover:border-f10-primary hover:text-f10-primary active:scale-[0.97] transition-[transform,border-color,color] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] duration-150"
          >
            {aceCopied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
