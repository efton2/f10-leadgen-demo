"use client";

import { useState } from "react";

interface Props {
  name: string;
  niche: string;
  address: string;
  rating: number;
  reviewCount: number;
  phone: string;
  website: string;
  snapshot?: string;
}

function renderProposal(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "---" || trimmed.startsWith("# ") || trimmed.toLowerCase().startsWith("prepared by")) {
      if (trimmed === "") elements.push(<div key={key++} className="h-1" />);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h3
          key={key++}
          className="font-heading text-lg font-semibold text-f10-text mt-6 mb-2 first:mt-0"
        >
          {trimmed.slice(3)}
        </h3>
      );
    } else {
      elements.push(
        <p key={key++} className="font-body text-sm text-gray-600 leading-relaxed">
          {trimmed}
        </p>
      );
    }
  }

  return elements;
}

export default function ProposalGenerator({
  name,
  niche,
  address,
  rating,
  reviewCount,
  phone,
  website,
  snapshot,
}: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [proposal, setProposal] = useState("");
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const generate = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, niche, address, rating, reviewCount, phone, website, snapshot }),
      });
      if (!res.ok) throw new Error("Proposal generation failed");
      const data = await res.json();
      setProposal(data.proposal);
      setState("done");
    } catch {
      setState("error");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(proposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const send = async () => {
    if (!email) return;
    setSendState("sending");
    try {
      const res = await fetch("/api/send-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, businessName: name, proposal }),
      });
      if (!res.ok) throw new Error("Send failed");
      setSendState("sent");
    } catch {
      setSendState("error");
    }
  };

  if (state === "idle") {
    return (
      <button
        onClick={generate}
        className="w-full bg-f10-primary text-white font-body text-sm font-semibold px-6 py-4 rounded-f10 hover:bg-[#3d5e8e] transition-colors text-center"
      >
        Generate Proposal
      </button>
    );
  }

  if (state === "loading") {
    return (
      <div className="w-full bg-white rounded-f10 border border-f10-border p-8 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-f10-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-body text-sm text-gray-500">Writing proposal for {name}...</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="w-full bg-white rounded-f10 border border-red-200 p-6 text-center">
        <p className="font-body text-sm text-red-500 mb-3">Proposal generation failed.</p>
        <button
          onClick={generate}
          className="font-body text-sm text-f10-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-f10 border border-f10-border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-f10-primary flex items-center justify-center">
            <span className="text-white text-[9px] font-semibold">F10</span>
          </div>
          <h2 className="font-heading text-xl font-semibold text-f10-text">AI Receptionist Proposal</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="font-body text-xs text-f10-primary border border-f10-primary px-3 py-1.5 rounded-full hover:bg-f10-tint transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => setState("idle")}
            className="font-body text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5"
          >
            Regenerate
          </button>
        </div>
      </div>

      <div className="border-t border-f10-border pt-4">
        {renderProposal(proposal)}
      </div>

      <div className="mt-6 pt-5 border-t border-f10-border">
        {sendState === "sent" ? (
          <div className="bg-green-50 border border-green-200 rounded-f10 px-5 py-4 text-center">
            <p className="font-body text-sm text-green-700 font-medium">Proposal sent to {email}</p>
            <button
              onClick={() => { setSendState("idle"); setEmail(""); }}
              className="font-body text-xs text-green-600 hover:underline mt-1"
            >
              Send to another address
            </button>
          </div>
        ) : (
          <div>
            <p className="font-body text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Send to Owner
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@business.com"
                className="flex-1 font-body text-sm border border-f10-border rounded-f10 px-4 py-2.5 focus:outline-none focus:border-f10-primary placeholder-gray-300"
              />
              <button
                onClick={send}
                disabled={!email || sendState === "sending"}
                className="bg-f10-primary text-white font-body text-sm font-semibold px-5 py-2.5 rounded-f10 hover:bg-[#3d5e8e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {sendState === "sending" ? "Sending..." : "Send Proposal"}
              </button>
            </div>
            {sendState === "error" && (
              <p className="font-body text-xs text-red-500 mt-2">Send failed. Check the email address and try again.</p>
            )}
            <p className="font-body text-xs text-gray-400 text-center mt-4">
              Generated by Function 10 Media AI &nbsp;&bull;&nbsp; $497 setup &nbsp;&bull;&nbsp; $297/month
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
