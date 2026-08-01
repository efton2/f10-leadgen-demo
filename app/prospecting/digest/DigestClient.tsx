"use client";
import { useState } from "react";

interface DigestLead {
  id: string;
  business_name: string;
  category: string;
  address: string;
  contact_email: string;
  audit_score: number | null;
  created_at: string;
}

export default function DigestClient({ leads }: { leads: DigestLead[] }) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const toggle = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const approve = async () => {
    const leadIds = leads.map((l) => l.id).filter((id) => !excluded.has(id));
    if (!leadIds.length) return;
    setStatus("sending");
    const res = await fetch("/api/prospecting/digest/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds }),
    });
    const data = await res.json();
    setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
    setStatus("done");
  };

  if (!leads.length) {
    return <p className="font-body text-f10-text/60">Nothing auto-queued right now.</p>;
  }

  const willSend = leads.length - excluded.size;

  return (
    <div className="bg-white rounded-f10 border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-left font-body text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="px-4 py-3"></th>
            <th className="px-4 py-3">Business</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Audit Score</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-b border-gray-100">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={!excluded.has(l.id)}
                  onChange={() => toggle(l.id)}
                  disabled={status !== "idle"}
                />
              </td>
              <td className="px-4 py-3 text-gray-900">{l.business_name}</td>
              <td className="px-4 py-3 text-gray-600">{l.category}</td>
              <td className="px-4 py-3 text-gray-600">{l.contact_email}</td>
              <td className="px-4 py-3 font-bold text-gray-900">{l.audit_score}/100</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-4">
        <button
          onClick={approve}
          disabled={status !== "idle" || willSend === 0}
          className="bg-f10-primary text-white font-body font-semibold px-6 py-3 rounded-f10 hover:bg-[#C8870A] active:scale-[0.97] transition-[transform,background-color] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "sending" ? "Sending..." : `Approve & Send (${willSend})`}
        </button>
        {status === "done" && result ? (
          <span className="font-body text-sm text-gray-600">
            Sent {result.sent}, failed {result.failed}.
          </span>
        ) : null}
      </div>
    </div>
  );
}
