// app/clients/ClientsClient.tsx
"use client";
import { useState } from "react";

const PROVISIONING_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-amber-100 text-amber-700",
  live: "bg-green-100 text-green-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};

interface Client {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  sku: string;
  payment_status: string;
  provisioning_status: string;
  go_live_date: string | null;
  notes: string;
  created_at: string;
}

export default function ClientsClient({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function updateClient(id: string, updates: Record<string, string>) {
    setSaving(id);
    const res = await fetch("/api/pipeline/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      const { client } = await res.json();
      setClients((prev) => prev.map((c) => (c.id === id ? client : c)));
    } else {
      setSaveError("Failed to save. Please try again.");
      setTimeout(() => setSaveError(null), 4000);
    }
    setSaving(null);
  }

  return (
    <div>
      {saveError && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded font-body text-sm text-red-600">
          {saveError}
        </div>
      )}
      <div className="bg-white rounded-f10 border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm font-body">
          <thead className="bg-f10-tint border-b border-gray-100">
            <tr>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Business</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">SKU</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Payment</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Provisioning</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Go Live</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-f10-text">{client.business_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {client.contact_email || client.contact_phone || "No contact yet"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={client.sku}
                    onChange={(e) => updateClient(client.id, { sku: e.target.value })}
                    disabled={saving === client.id}
                    aria-label={`SKU for ${client.business_name}`}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  >
                    <option value="dfy">DFY</option>
                    <option value="dwy">DWY</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={client.payment_status}
                    onChange={(e) => updateClient(client.id, { payment_status: e.target.value })}
                    disabled={saving === client.id}
                    aria-label={`Payment status for ${client.business_name}`}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${PAYMENT_COLORS[client.payment_status] ?? PAYMENT_COLORS.pending}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={client.provisioning_status}
                    onChange={(e) => updateClient(client.id, { provisioning_status: e.target.value })}
                    disabled={saving === client.id}
                    aria-label={`Provisioning status for ${client.business_name}`}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${PROVISIONING_COLORS[client.provisioning_status] ?? PROVISIONING_COLORS.not_started}`}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="live">Live</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="date"
                    defaultValue={client.go_live_date ?? ""}
                    onBlur={(e) => updateClient(client.id, { go_live_date: e.target.value })}
                    aria-label={`Go live date for ${client.business_name}`}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={client.notes}
                    onBlur={(e) => {
                      if (e.target.value !== client.notes) {
                        updateClient(client.id, { notes: e.target.value });
                      }
                    }}
                    placeholder="Add notes..."
                    aria-label={`Notes for ${client.business_name}`}
                    className="w-full text-xs text-gray-600 placeholder-gray-300 border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-f10-primary rounded px-1 py-0.5"
                  />
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No clients yet. Mark a lead as Closed in the Pipeline to create a client record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
