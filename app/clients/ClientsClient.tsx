// app/clients/ClientsClient.tsx
"use client";
import { Fragment, useState } from "react";

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

const REVIEW_STATUS_COLORS: Record<string, string> = {
  queued: "bg-gray-100 text-gray-600",
  sent: "bg-green-100 text-green-700",
  reminded: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-600",
  reviewed: "bg-purple-100 text-purple-700",
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
  weekly_report_enabled: boolean;
  instagram_handle: string | null;
  report_email: string | null;
  google_review_link: string | null;
}

interface ReviewRequest {
  id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  error: string;
  requested_at: string | null;
  created_at: string;
}

export default function ClientsClient({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [reviewRequests, setReviewRequests] = useState<Record<string, ReviewRequest[]>>({});
  const [reviewsLoading, setReviewsLoading] = useState<string | null>(null);
  // Keyed per client id — previously a single shared object, so switching to
  // a different client's Manage panel without sending could leak the first
  // client's typed name/email into a send under the second client's context.
  const [reviewForms, setReviewForms] = useState<Record<string, { name: string; email: string }>>({});
  const [reviewSending, setReviewSending] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [markingReviewedId, setMarkingReviewedId] = useState<string | null>(null);

  const EMPTY_REVIEW_FORM = { name: "", email: "" };
  const getReviewForm = (clientId: string) => reviewForms[clientId] ?? EMPTY_REVIEW_FORM;

  async function toggleReviews(clientId: string) {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
      return;
    }
    setExpandedClientId(clientId);
    setReviewError(null);
    if (!reviewRequests[clientId]) {
      setReviewsLoading(clientId);
      try {
        const res = await fetch(`/api/reviews?client_id=${clientId}`);
        if (res.ok) {
          const { reviewRequests: rows } = await res.json();
          setReviewRequests((prev) => ({ ...prev, [clientId]: rows }));
        } else {
          setReviewError("Failed to load review history. Please try again.");
        }
      } catch {
        setReviewError("Failed to load review history — check your connection.");
      } finally {
        setReviewsLoading(null);
      }
    }
  }

  async function sendReviewRequest(client: Client) {
    const form = getReviewForm(client.id);
    if (!client.google_review_link) {
      setReviewError("Add a Google review link for this client first.");
      return;
    }
    if (!form.name.trim() || !form.email.trim()) {
      setReviewError("Customer name and email are both required.");
      return;
    }
    setReviewSending(client.id);
    setReviewError(null);
    try {
      const res = await fetch("/api/reviews/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          customer_name: form.name.trim(),
          customer_email: form.email.trim(),
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setReviewRequests((prev) => ({
          ...prev,
          [client.id]: [result.reviewRequest, ...(prev[client.id] ?? [])],
        }));
        setReviewForms((prev) => ({ ...prev, [client.id]: EMPTY_REVIEW_FORM }));
      } else {
        setReviewError(result.error ?? "Failed to send review request.");
      }
    } catch {
      setReviewError("Failed to send review request — check your connection.");
    } finally {
      setReviewSending(null);
    }
  }

  async function markReviewed(clientId: string, requestId: string) {
    setMarkingReviewedId(requestId);
    try {
      const res = await fetch(`/api/reviews/${requestId}/mark-reviewed`, { method: "PATCH" });
      if (res.ok) {
        const { reviewRequest } = await res.json();
        setReviewRequests((prev) => ({
          ...prev,
          [clientId]: (prev[clientId] ?? []).map((r) => (r.id === requestId ? reviewRequest : r)),
        }));
      } else {
        setReviewError("Failed to mark reviewed. Please try again.");
      }
    } catch {
      setReviewError("Failed to mark reviewed — check your connection.");
    } finally {
      setMarkingReviewedId(null);
    }
  }

  async function updateClient(id: string, updates: Record<string, string | null>) {
    setSaving(id);
    try {
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
    } catch {
      setSaveError("Failed to save — check your connection.");
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSaving(null);
    }
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
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Weekly Report</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Instagram</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Report Email</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Google Review Link</th>
              <th scope="col" className="text-left px-4 py-3 text-gray-500 font-medium">Reviews</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clients.map((client) => (
              <Fragment key={client.id}>
              <tr className="hover:bg-gray-50 transition-colors">
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
                    onBlur={(e) => updateClient(client.id, { go_live_date: e.target.value || null })}
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
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={client.weekly_report_enabled ?? false}
                    onChange={(e) => updateClient(client.id, { weekly_report_enabled: String(e.target.checked) })}
                    aria-label={`Weekly report for ${client.business_name}`}
                    className="w-4 h-4 accent-f10-primary cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={client.instagram_handle ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (client.instagram_handle ?? "")) {
                        updateClient(client.id, { instagram_handle: e.target.value || null });
                      }
                    }}
                    placeholder="@handle"
                    aria-label={`Instagram handle for ${client.business_name}`}
                    className="w-32 text-xs text-gray-600 placeholder-gray-300 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-f10-primary"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="email"
                    defaultValue={client.report_email ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (client.report_email ?? "")) {
                        updateClient(client.id, { report_email: e.target.value || null });
                      }
                    }}
                    placeholder={client.contact_email || "email"}
                    aria-label={`Report email for ${client.business_name}`}
                    className="w-44 text-xs text-gray-600 placeholder-gray-300 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-f10-primary"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="url"
                    defaultValue={client.google_review_link ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (client.google_review_link ?? "")) {
                        updateClient(client.id, { google_review_link: e.target.value || null });
                      }
                    }}
                    placeholder="https://g.page/r/..."
                    aria-label={`Google review link for ${client.business_name}`}
                    className="w-48 text-xs text-gray-600 placeholder-gray-300 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-f10-primary"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleReviews(client.id)}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-gray-200 text-f10-text hover:bg-f10-tint transition-colors"
                  >
                    {expandedClientId === client.id ? "Hide" : "Manage"}
                  </button>
                </td>
              </tr>
              {expandedClientId === client.id && (
                <tr key={`${client.id}-reviews`} className="bg-f10-tint">
                  <td colSpan={11} className="px-6 py-5">
                    <div className="max-w-2xl">
                      <p className="font-body text-xs font-medium text-gray-500 mb-3">
                        Request a Google review from a {client.business_name} customer
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Customer name"
                          value={getReviewForm(client.id).name}
                          onChange={(e) =>
                            setReviewForms((prev) => ({
                              ...prev,
                              [client.id]: { ...getReviewForm(client.id), name: e.target.value },
                            }))
                          }
                          className="flex-1 text-sm border border-gray-200 rounded px-3 py-2"
                        />
                        <input
                          type="email"
                          placeholder="Customer email"
                          value={getReviewForm(client.id).email}
                          onChange={(e) =>
                            setReviewForms((prev) => ({
                              ...prev,
                              [client.id]: { ...getReviewForm(client.id), email: e.target.value },
                            }))
                          }
                          className="flex-1 text-sm border border-gray-200 rounded px-3 py-2"
                        />
                        <button
                          type="button"
                          disabled={reviewSending === client.id}
                          onClick={() => sendReviewRequest(client)}
                          className="text-sm font-medium px-4 py-2 rounded bg-f10-primary text-white disabled:opacity-50"
                        >
                          {reviewSending === client.id ? "Sending..." : "Send Request"}
                        </button>
                      </div>
                      {reviewError && (
                        <p className="text-xs text-red-600 mb-3">{reviewError}</p>
                      )}
                      {!client.google_review_link && (
                        <p className="text-xs text-amber-600 mb-3">
                          Add a Google review link in the column to the left before sending requests.
                        </p>
                      )}

                      <p className="font-body text-xs font-medium text-gray-500 mt-4 mb-2">History</p>
                      {reviewsLoading === client.id ? (
                        <p className="text-xs text-gray-400">Loading...</p>
                      ) : (reviewRequests[client.id] ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400">No review requests sent yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(reviewRequests[client.id] ?? []).map((r) => (
                            <div key={r.id} className="flex items-center gap-3 text-xs">
                              <span className={`font-medium px-2 py-0.5 rounded-full ${REVIEW_STATUS_COLORS[r.status] ?? REVIEW_STATUS_COLORS.queued}`}>
                                {r.status}
                              </span>
                              <span className="text-f10-text">{r.customer_name}</span>
                              <span className="text-gray-400">{r.customer_email}</span>
                              {r.error && <span className="text-red-500">{r.error}</span>}
                              {r.status === "sent" && (
                                <button
                                  type="button"
                                  disabled={markingReviewedId === r.id}
                                  onClick={() => markReviewed(client.id, r.id)}
                                  className="ml-auto text-purple-700 hover:underline disabled:opacity-50"
                                >
                                  {markingReviewedId === r.id ? "Marking..." : "Mark reviewed"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
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
