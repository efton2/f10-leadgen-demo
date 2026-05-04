// app/pipeline/PipelineClient.tsx
"use client";
import { useState } from "react";
import Link from "next/link";

const STATUSES = ["new", "reviewed", "demoed", "proposal_sent", "closed", "active", "recurring"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  reviewed: "Reviewed",
  demoed: "Demoed",
  proposal_sent: "Proposal Sent",
  closed: "Closed",
  active: "Active",
  recurring: "Recurring",
};

const STATUS_COLORS: Record<Status, string> = {
  new: "bg-gray-100 text-gray-600",
  reviewed: "bg-blue-100 text-blue-700",
  demoed: "bg-purple-100 text-purple-700",
  proposal_sent: "bg-amber-100 text-amber-700",
  closed: "bg-green-100 text-green-700",
  active: "bg-emerald-100 text-emerald-700",
  recurring: "bg-teal-100 text-teal-700",
};

interface PipelineLead {
  id: string;
  place_id: string;
  business_name: string;
  address: string;
  rating: number;
  review_count: number;
  category: string;
  city: string;
  status: Status;
  notes: string;
  created_at: string;
  updated_at: string;
}

export default function PipelineClient({ initialLeads }: { initialLeads: PipelineLead[] }) {
  const [leads, setLeads] = useState<PipelineLead[]>(initialLeads);
  const [saving, setSaving] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState<string | null>(null);

  async function updateLead(id: string, updates: { status?: Status; notes?: string }) {
    setSaving(id);
    const res = await fetch("/api/pipeline/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      const { lead } = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? lead : l)));
    }
    setSaving(null);
  }

  async function createClient(lead: PipelineLead) {
    setCreatingClient(lead.id);
    const res = await fetch("/api/pipeline/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: lead.id,
        business_name: lead.business_name,
        contact_phone: lead.address,
      }),
    });
    if (res.ok) {
      alert(`Client record created for ${lead.business_name}. Go to Clients tab to fill in details.`);
    } else {
      alert("Failed to create client record.");
    }
    setCreatingClient(null);
  }

  return (
    <div className="bg-white rounded-f10 border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm font-body">
        <thead className="bg-f10-tint border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Business</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">City</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Rating</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Notes</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/lead/${lead.place_id}`}
                  className="text-f10-primary hover:underline font-medium"
                >
                  {lead.business_name}
                </Link>
                <div className="text-xs text-gray-400 mt-0.5">{lead.category}</div>
              </td>
              <td className="px-4 py-3 text-gray-600">{lead.city}</td>
              <td className="px-4 py-3 text-gray-600">
                {lead.rating > 0 ? `${lead.rating} (${lead.review_count})` : "—"}
              </td>
              <td className="px-4 py-3">
                <select
                  value={lead.status}
                  onChange={(e) => updateLead(lead.id, { status: e.target.value as Status })}
                  disabled={saving === lead.id}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[lead.status]}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <input
                  type="text"
                  defaultValue={lead.notes}
                  onBlur={(e) => {
                    if (e.target.value !== lead.notes) {
                      updateLead(lead.id, { notes: e.target.value });
                    }
                  }}
                  placeholder="Add notes..."
                  className="w-full text-xs text-gray-600 placeholder-gray-300 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-f10-primary rounded px-1 py-0.5"
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {saving === lead.id && (
                    <span className="text-xs text-gray-400">Saving...</span>
                  )}
                  {lead.status === "closed" && (
                    <button
                      onClick={() => createClient(lead)}
                      disabled={creatingClient === lead.id}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      {creatingClient === lead.id ? "Creating..." : "Create Client"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                No leads yet. Search for a business and click into it to add it here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
