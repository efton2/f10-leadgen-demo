"use client";

import { useState } from "react";
import Link from "next/link";
import type { Lead } from "./api/leads/route";

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= full ? "text-amber-400" : i === full + 1 && half ? "text-amber-300" : "text-gray-600"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const niceType = lead.types[0]?.replace(/_/g, " ") ?? "Business";
  return (
    <Link
      href={`/lead/${lead.placeId}`}
      className="block bg-f10-tint rounded-f10 border border-f10-border p-5 hover:border-f10-primary hover:shadow-md hover:shadow-f10-primary/10 active:scale-[0.99] transition-[transform,border-color,box-shadow] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] duration-150 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-heading text-lg font-semibold text-f10-text group-hover:text-f10-primary transition-colors leading-tight">
          {lead.name}
        </h3>
        <span className="shrink-0 font-body text-xs bg-f10-bg text-f10-primary px-2 py-1 rounded-full capitalize border border-f10-border">
          {niceType}
        </span>
      </div>

      {lead.rating > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <StarRating rating={lead.rating} />
          <span className="font-body text-xs text-gray-500">
            {lead.rating.toFixed(1)} ({lead.reviewCount.toLocaleString()} reviews)
          </span>
        </div>
      )}

      <p className="font-body text-sm text-gray-400 mb-2 leading-snug">{lead.address}</p>

      <div className="flex items-center mt-3">
        <span className="ml-auto font-body text-xs text-f10-primary font-medium group-hover:underline">
          View lead →
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!niche.trim() || !city.trim()) return;
    setLoading(true);
    setError("");
    setLeads([]);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim(), city: city.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setLeads(data.leads);
      setQuery(data.query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-f10-bg flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-f10-border bg-f10-bg px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-f10-primary flex items-center justify-center">
            <span className="text-white text-xs font-body font-semibold">F10</span>
          </div>
          <span className="font-heading text-xl font-semibold text-f10-text tracking-wide">
            Simporic
          </span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/pipeline" className="font-body text-sm text-gray-400 hover:text-f10-primary transition-colors">Pipeline</Link>
          <Link href="/clients" className="font-body text-sm text-gray-400 hover:text-f10-primary transition-colors">Clients</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center px-8 pt-16 pb-10 text-center">
        <p className="font-body text-xs font-semibold tracking-widest uppercase text-f10-primary mb-4 border border-f10-primary/30 px-4 py-1.5 rounded-full">
          Praeco
        </p>
        <h1 className="font-heading text-5xl md:text-6xl font-semibold text-f10-text leading-tight mb-5 max-w-3xl">
          Deploy an AI Receptionist in Under Two Minutes
        </h1>
        <p className="font-body text-lg text-gray-400 max-w-xl mb-10 leading-relaxed">
          Search any business type in any city. Pick a lead. Get a working AI voice agent and a branded proposal ready to send.
        </p>

        {/* Search form */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl bg-f10-tint rounded-f10 border border-f10-border p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Business type (dentists, salons, HVAC...)"
              className="w-full sm:flex-1 font-body text-sm bg-f10-bg text-f10-text border border-f10-border rounded-f10 px-4 py-3 focus:outline-none focus:border-f10-primary transition-colors placeholder:text-gray-600"
            />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City or zip"
              className="w-full sm:w-36 font-body text-sm bg-f10-bg text-f10-text border border-f10-border rounded-f10 px-4 py-3 focus:outline-none focus:border-f10-primary transition-colors placeholder:text-gray-600"
            />
            <button
              type="submit"
              disabled={loading || !niche.trim() || !city.trim()}
              className="w-full sm:w-auto bg-f10-primary text-white font-body text-sm font-medium px-6 py-3 rounded-f10 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#C8870A] active:scale-[0.97] transition-[transform,background-color] [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] duration-150"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
          {error && (
            <p className="font-body text-xs text-red-400 mt-3 text-center">{error}</p>
          )}
        </form>
      </section>

      {/* Results */}
      <section className="flex-1 px-8 pb-16 max-w-5xl mx-auto w-full">
        {leads.length > 0 && (
          <>
            <p className="font-body text-sm text-gray-500 mb-5">
              Showing {leads.length} results for <span className="font-medium text-f10-text">{query}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leads.map((lead) => (
                <LeadCard key={lead.placeId} lead={lead} />
              ))}
            </div>
          </>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-f10-tint rounded-f10 border border-f10-border p-5 animate-pulse">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="h-5 bg-f10-bg rounded w-2/3" />
                  <div className="h-5 bg-f10-bg rounded-full w-16 shrink-0" />
                </div>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="h-3.5 w-3.5 bg-f10-bg rounded-full" />
                  ))}
                  <div className="h-3 bg-f10-bg rounded w-20 ml-1" />
                </div>
                <div className="h-3 bg-f10-bg rounded w-full mb-2" />
                <div className="h-3 bg-f10-bg rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

        {!loading && leads.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-f10-tint border border-f10-border flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-f10-primary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
              </svg>
            </div>
            <p className="font-body text-sm text-gray-500">Enter a business type and city to find leads</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-f10-footer border-t border-f10-border px-8 py-5 text-center">
        <p className="font-body text-xs text-gray-600">
          Simporic
        </p>
      </footer>
    </main>
  );
}
