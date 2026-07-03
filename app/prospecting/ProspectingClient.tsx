"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { estimateBatchCost } from "@/lib/usage";

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

const BATCH_STATUS_COLORS: Record<string, string> = {
  running: "bg-blue-100 text-blue-700",
  ready_for_review: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-500",
};

const BATCH_STATUS_LABELS: Record<string, string> = {
  running: "Running",
  ready_for_review: "Ready for Review",
  failed: "Failed",
  archived: "Archived",
};

export default function ProspectingClient({
  initialBatches,
  counts,
}: {
  initialBatches: Batch[];
  counts: Record<string, Record<string, number>>;
}) {
  const router = useRouter();
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [count, setCount] = useState(10);
  const [depth, setDepth] = useState<"lite" | "full">("lite");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const estimate = useMemo(
    () => estimateBatchCost({ count: Math.min(Math.max(count || 1, 1), 60), depth }),
    [count, depth]
  );

  async function runBatch() {
    if (!niche.trim() || !city.trim()) {
      setError("Enter a niche and a city first.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/prospecting/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim(), city: city.trim(), count, depth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create batch");
      router.push(`/prospecting/${data.batchId}`);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setCreating(false);
    }
  }

  function progressLabel(batchId: string): string {
    const c = counts[batchId] ?? {};
    const ready = c.ready ?? 0;
    const sent = c.sent ?? 0;
    const failed = c.failed ?? 0;
    const dupes = c.skipped_duplicate ?? 0;
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    const working = total - ready - sent - failed - dupes - (c.rejected ?? 0) - (c.approved ?? 0);
    const parts: string[] = [];
    if (working > 0) parts.push(`${working} processing`);
    if (ready > 0) parts.push(`${ready} ready`);
    if (sent > 0) parts.push(`${sent} sent`);
    if (failed > 0) parts.push(`${failed} failed`);
    if (dupes > 0) parts.push(`${dupes} duplicate`);
    return parts.length ? parts.join(" · ") : `${total} leads`;
  }

  return (
    <div className="space-y-8">
      {/* New batch form */}
      <div className="bg-white rounded-f10 border border-gray-100 shadow-sm p-6">
        <h2 className="font-heading text-xl text-gray-900 mb-4">New Batch</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Niche (e.g. med spa)"
            className="border border-gray-200 rounded-f10 px-4 py-2 font-body text-sm text-gray-900 focus:outline-none focus:border-f10-primary"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g. Boise, ID)"
            className="border border-gray-200 rounded-f10 px-4 py-2 font-body text-sm text-gray-900 focus:outline-none focus:border-f10-primary"
          />
          <input
            type="number"
            min={1}
            max={60}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="border border-gray-200 rounded-f10 px-4 py-2 font-body text-sm text-gray-900 focus:outline-none focus:border-f10-primary"
          />
          <select
            value={depth}
            onChange={(e) => setDepth(e.target.value as "lite" | "full")}
            className="border border-gray-200 rounded-f10 px-4 py-2 font-body text-sm text-gray-900 focus:outline-none focus:border-f10-primary cursor-pointer"
          >
            <option value="lite">Competitive: Lite (in-batch, cheap)</option>
            <option value="full">Competitive: Full (Apify scrape, +cost)</option>
          </select>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="font-body text-sm text-gray-500">
            Estimated cost:{" "}
            <span className="font-semibold text-gray-900">${estimate.total.toFixed(2)}</span>
            <span className="text-gray-400">
              {" "}
              (Places ${estimate.places.toFixed(2)} · Claude ${estimate.claude.toFixed(2)} · Apify $
              {estimate.apify.toFixed(2)} · ~${estimate.perLead.toFixed(2)}/lead)
            </span>
          </div>
          <button
            onClick={runBatch}
            disabled={creating}
            className="bg-f10-primary text-white font-body font-semibold px-6 py-3 rounded-f10 hover:bg-[#C8870A] active:scale-[0.97] transition-[transform,background-color] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Pulling leads..." : `Run Batch (est. $${estimate.total.toFixed(2)})`}
          </button>
        </div>
        {error && (
          <p className="mt-3 font-body text-sm text-red-500">{error}</p>
        )}
        <p className="mt-3 font-body text-xs text-gray-400">
          Running a batch spends the estimate above on lead pull and enrichment. No email is ever
          sent without your per-lead approval on the batch page.
        </p>
      </div>

      {/* Batch list */}
      <div className="bg-white rounded-f10 border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-f10-tint border-b border-gray-100">
              <th className="text-left font-body text-xs font-semibold text-f10-text uppercase tracking-wide px-6 py-3">Batch</th>
              <th className="text-left font-body text-xs font-semibold text-f10-text uppercase tracking-wide px-6 py-3">Progress</th>
              <th className="text-left font-body text-xs font-semibold text-f10-text uppercase tracking-wide px-6 py-3">Cost</th>
              <th className="text-left font-body text-xs font-semibold text-f10-text uppercase tracking-wide px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {initialBatches.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center font-body text-sm text-gray-400">
                  No batches yet. Run your first one above.
                </td>
              </tr>
            )}
            {initialBatches.map((b) => (
              <tr
                key={b.id}
                onClick={() => router.push(`/prospecting/${b.id}`)}
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="font-body text-sm font-semibold text-gray-900">
                    {b.niche} · {b.city}
                  </div>
                  <div className="font-body text-xs text-gray-400">
                    {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                    {b.requested_count} leads · {b.competitive_depth}
                  </div>
                </td>
                <td className="px-6 py-4 font-body text-sm text-gray-600">{progressLabel(b.id)}</td>
                <td className="px-6 py-4 font-body text-sm text-gray-600">
                  est ${Number(b.est_cost_usd ?? 0).toFixed(2)}
                  {Number(b.actual_cost_usd ?? 0) > 0 && (
                    <span className="text-gray-400"> → ${Number(b.actual_cost_usd).toFixed(2)}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block font-body text-xs font-semibold px-3 py-1 rounded-full ${BATCH_STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-500"}`}
                  >
                    {BATCH_STATUS_LABELS[b.status] ?? b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
