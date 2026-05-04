import Link from "next/link";
import type { Metadata } from "next";
import { getLeadDetail } from "@/app/lib/getLeadDetail";
import ReceptionistOrb from "@/app/components/ReceptionistOrb";
import ProposalGenerator from "@/app/components/ProposalGenerator";
import { supabase } from "@/lib/supabase";

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-f10-tint rounded-f10 px-5 py-4 text-center">
      <p className="font-heading text-2xl font-semibold text-f10-primary">{value}</p>
      <p className="font-body text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i <= full ? "text-amber-400" : i === full + 1 && half ? "text-amber-300" : "text-gray-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export async function generateMetadata({
  params,
}: {
  params: { placeId: string };
}): Promise<Metadata> {
  const lead = await getLeadDetail(params.placeId);
  if (!lead) return { title: "Lead Not Found" };
  return {
    title: `${lead.name} — F10 AI Lead Gen`,
    description: `AI Receptionist proposal for ${lead.name} in ${lead.address.split(",")[1]?.trim() ?? "your area"}.`,
  };
}

export default async function LeadDetailPage({
  params,
}: {
  params: { placeId: string };
}) {
  const lead = await getLeadDetail(params.placeId);

  // Auto-save to pipeline on first view — upsert ignores if already exists
  if (lead) {
    await supabase.from("pipeline_leads").upsert(
      {
        place_id: params.placeId,
        business_name: lead.name,
        address: lead.address,
        phone: lead.phone ?? "",
        rating: lead.rating,
        review_count: lead.reviewCount,
        category: lead.types[0]?.replace(/_/g, " ") ?? "",
        city: lead.address.split(",")[1]?.trim() ?? "",
      },
      { onConflict: "place_id", ignoreDuplicates: true }
    );
  }

  if (!lead) {
    return (
      <main className="min-h-screen bg-f10-bg flex flex-col items-center justify-center">
        <p className="font-body text-gray-400">Unable to load lead details. Please go back and try again.</p>
        <Link href="/" className="mt-4 font-body text-sm text-f10-primary hover:underline">
          Back to search
        </Link>
      </main>
    );
  }

  const niceType = lead.types[0]?.replace(/_/g, " ") ?? "Business";

  return (
    <main className="min-h-screen bg-f10-bg flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-f10-border bg-white px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-f10-primary flex items-center justify-center">
            <span className="text-white text-xs font-body font-semibold">F10</span>
          </div>
          <span className="font-heading text-xl font-semibold text-f10-text tracking-wide">
            AI Operator Systems
          </span>
        </div>
        <Link href="/" className="font-body text-sm text-f10-primary hover:underline">
          ← Back to search
        </Link>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-12">

        {/* Business header */}
        <div className="mb-8">
          <span className="font-body text-xs font-semibold tracking-widest uppercase text-f10-primary bg-f10-tint px-3 py-1 rounded-full capitalize">
            {niceType}
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-semibold text-f10-text mt-4 mb-3 leading-tight">
            {lead.name}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            {lead.rating > 0 && (
              <>
                <StarRating rating={lead.rating} />
                <span className="font-body text-sm text-gray-500">
                  {lead.rating.toFixed(1)} ({lead.reviewCount.toLocaleString()} reviews)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatBadge label="Rating" value={lead.rating > 0 ? `${lead.rating.toFixed(1)}★` : "N/A"} />
          <StatBadge label="Reviews" value={lead.reviewCount > 0 ? lead.reviewCount.toLocaleString() : "0"} />
          <StatBadge label="Category" value={niceType.charAt(0).toUpperCase() + niceType.slice(1)} />
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-f10 border border-f10-border p-6 mb-6">
          <h2 className="font-heading text-xl font-semibold text-f10-text mb-4">Contact Information</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-f10-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-body text-sm text-gray-600">{lead.address}</span>
            </div>
            {lead.phone && (
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-f10-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="font-body text-sm text-gray-600">{lead.phone}</span>
              </div>
            )}
            {lead.website && (
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-f10-primary shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.102 1.101" />
                </svg>
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-f10-primary hover:underline truncate"
                >
                  {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Business snapshot */}
        {lead.snapshot && (
          <div className="bg-white rounded-f10 border border-f10-border p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-f10-primary flex items-center justify-center">
                <span className="text-white text-[9px] font-semibold">AI</span>
              </div>
              <h2 className="font-heading text-xl font-semibold text-f10-text">Business Snapshot</h2>
            </div>
            <p className="font-body text-sm text-gray-600 leading-relaxed">{lead.snapshot}</p>
          </div>
        )}

        {/* Hours */}
        {lead.hours.length > 0 && (
          <div className="bg-white rounded-f10 border border-f10-border p-6 mb-8">
            <h2 className="font-heading text-xl font-semibold text-f10-text mb-4">Business Hours</h2>
            <ul className="space-y-1.5">
              {lead.hours.map((h, i) => (
                <li key={i} className="font-body text-sm text-gray-600">{h}</li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Receptionist */}
        <div className="mb-6">
          <ReceptionistOrb
            name={lead.name}
            niche={niceType}
            phone={lead.phone}
          />
        </div>

        {/* Proposal generator */}
        <ProposalGenerator
          name={lead.name}
          niche={niceType}
          address={lead.address}
          rating={lead.rating}
          reviewCount={lead.reviewCount}
          phone={lead.phone}
          website={lead.website}
          snapshot={lead.snapshot}
          placeId={params.placeId}
        />

      </div>

      {/* Footer */}
      <footer className="bg-f10-footer border-t border-f10-border px-8 py-5 text-center">
        <p className="font-body text-xs text-gray-400">
          Function 10 Media LLC &nbsp;&bull;&nbsp; AI Operator Systems Demo
        </p>
      </footer>
    </main>
  );
}
