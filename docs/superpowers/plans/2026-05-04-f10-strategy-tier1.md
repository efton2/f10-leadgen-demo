# F10 Strategy Platform — Tier 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login, lead pipeline CRM, client records, and custom subdomain to the existing lead gen demo so it can be used as a production sales tool at app.f10strategy.com.

**Architecture:** Extend the existing Next.js 14 App Router app with four additions: middleware-based password auth using an env var and HTTP-only cookie; a Supabase-backed pipeline CRM that auto-saves leads on detail page view and tracks status through all 7 stages; a client records page that creates a client entry when a lead is marked Closed; and a custom domain pointing app.f10strategy.com at the existing Vercel deployment.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (already installed via @supabase/supabase-js), Vercel, Cloudflare DNS.

> **Note on testing:** This codebase has no test framework installed. Each task uses manual browser smoke tests instead of automated tests. The smoke test steps are explicit and must be run before committing.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `middleware.ts` | Create | Protect all routes except `/login` and `/api/auth/*` — redirect to `/login` if no valid session cookie |
| `app/login/page.tsx` | Create | Password form — POSTs to `/api/auth/login`, redirects to `/` on success |
| `app/api/auth/login/route.ts` | Create | Checks `SITE_PASSWORD` env var, sets `f10_session` HTTP-only cookie |
| `app/api/auth/logout/route.ts` | Create | Clears `f10_session` cookie, redirects to `/login` |
| `lib/supabase.ts` | Create | Supabase client singleton using `SUPABASE_URL` + `SUPABASE_ANON_KEY` |
| `supabase/migrations/001_pipeline.sql` | Create | Creates `pipeline_leads` and `clients` tables |
| `app/lead/[placeId]/page.tsx` | Modify | Auto-save lead to `pipeline_leads` on detail page load (upsert by place_id) |
| `app/api/pipeline/leads/route.ts` | Create | `GET` all pipeline leads sorted by updated_at desc; `PATCH` lead status and notes |
| `app/pipeline/page.tsx` | Create | Server component — fetches leads from Supabase, renders `PipelineClient` |
| `app/pipeline/PipelineClient.tsx` | Create | Client component — table with status dropdown, notes field, inline save, create client button |
| `app/api/pipeline/clients/route.ts` | Create | `GET` all clients; `POST` create client from a closed lead |
| `app/clients/page.tsx` | Create | Server component — fetches clients from Supabase, renders `ClientsClient` |
| `app/clients/ClientsClient.tsx` | Create | Client component — table showing all active clients with provisioning status |
| `app/layout.tsx` | Modify | Add nav links to Pipeline and Clients pages |

---

## Task 1: Supabase Tables

**Files:**
- Create: `supabase/migrations/001_pipeline.sql`

Run this SQL directly in the Supabase dashboard SQL editor for the PlacementIQ project (the one already in `.env.local` — `SUPABASE_URL=https://nxwvstbtispnthcygjzt.supabase.co`).

- [ ] **Step 1: Open Supabase SQL editor**

Go to https://supabase.com → PlacementIQ project → SQL Editor → New query.

- [ ] **Step 2: Run the migration**

Paste and run:

```sql
-- Pipeline leads: saved when Efton clicks into a lead detail page
CREATE TABLE IF NOT EXISTS pipeline_leads (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id      TEXT        UNIQUE NOT NULL,
  business_name TEXT        NOT NULL,
  address       TEXT        DEFAULT '',
  phone         TEXT        DEFAULT '',
  rating        NUMERIC     DEFAULT 0,
  review_count  INTEGER     DEFAULT 0,
  category      TEXT        DEFAULT '',
  city          TEXT        DEFAULT '',
  status        TEXT        DEFAULT 'new' NOT NULL
                            CHECK (status IN ('new','reviewed','demoed','proposal_sent','closed','active','recurring')),
  notes         TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Clients: created when a pipeline lead is marked closed
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id             UUID        REFERENCES pipeline_leads(id) ON DELETE SET NULL,
  business_name       TEXT        NOT NULL,
  contact_name        TEXT        DEFAULT '',
  contact_email       TEXT        DEFAULT '',
  contact_phone       TEXT        DEFAULT '',
  sku                 TEXT        DEFAULT 'dfy' NOT NULL
                                  CHECK (sku IN ('dfy','dwy')),
  payment_status      TEXT        DEFAULT 'pending' NOT NULL
                                  CHECK (payment_status IN ('pending','active','paused','cancelled')),
  provisioning_status TEXT        DEFAULT 'not_started' NOT NULL
                                  CHECK (provisioning_status IN ('not_started','in_progress','live')),
  go_live_date        DATE,
  notes               TEXT        DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on pipeline_leads
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pipeline_leads_updated_at
  BEFORE UPDATE ON pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 3: Verify tables exist**

Run in SQL editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('pipeline_leads', 'clients');
```
Expected: two rows returned.

- [ ] **Step 4: Save the migration file**

Create `supabase/migrations/001_pipeline.sql` with the SQL above so it is tracked in git.

```bash
mkdir -p supabase/migrations
# paste the SQL into the file
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/001_pipeline.sql
git commit -m "feat: add pipeline_leads and clients tables to Supabase"
```

---

## Task 2: Supabase Client Singleton

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Verify env vars are present**

```bash
grep -E "SUPABASE_URL|SUPABASE_ANON_KEY" .env.local
```
Expected: both lines present with values.

- [ ] **Step 3: Smoke test the connection**

Run this once in a temporary script to confirm the connection works:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
sb.from('pipeline_leads').select('count').then(r => console.log('OK:', r)).catch(e => console.error('FAIL:', e));
"
```
Expected: `OK: { data: [...], error: null }`

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add Supabase client singleton"
```

---

## Task 3: Auth — Password Login + Middleware

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Add SITE_PASSWORD to .env.local**

```bash
echo "SITE_PASSWORD=your_chosen_password_here" >> .env.local
```

Also add `SITE_PASSWORD` to Vercel environment variables:
```bash
vercel env add SITE_PASSWORD production
```

- [ ] **Step 2: Create the login API route**

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  if (password !== sitePassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Simple token: base64 of password — sufficient for an internal single-user tool
  const token = Buffer.from(sitePassword).toString("base64");

  const response = NextResponse.json({ ok: true });
  response.cookies.set("f10_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}
```

- [ ] **Step 3: Create the logout route**

```typescript
// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000")
  );
  response.cookies.delete("f10_session");
  return response;
}
```

- [ ] **Step 4: Create the middleware**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("f10_session");
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) return NextResponse.next(); // skip auth if not configured

  const expectedToken = Buffer.from(sitePassword).toString("base64");

  if (!sessionCookie || sessionCookie.value !== expectedToken) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Create the login page**

```typescript
// app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Incorrect password.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-f10-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl text-f10-text text-center mb-2">F10 Strategy</h1>
        <p className="font-body text-sm text-gray-400 text-center mb-8">Internal Sales Platform</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-f10 shadow-sm border border-gray-100 p-8">
          <label className="block font-body text-sm text-gray-600 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 font-body text-sm focus:outline-none focus:ring-2 focus:ring-f10-primary mb-4"
            placeholder="Enter access password"
            autoFocus
            required
          />
          {error && <p className="font-body text-sm text-red-500 mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-f10-primary text-white font-body text-sm font-medium py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Smoke test auth**

```bash
npm run dev
```

1. Open http://localhost:3000 — should redirect to http://localhost:3000/login
2. Enter wrong password — should show "Incorrect password."
3. Enter correct password from `.env.local` — should redirect to homepage
4. Refresh page — should stay on homepage (cookie persists)
5. Open http://localhost:3000/login while logged in — should still work (no loop)

- [ ] **Step 7: Commit**

```bash
git add middleware.ts app/login/page.tsx app/api/auth/login/route.ts app/api/auth/logout/route.ts
git commit -m "feat: add password auth with cookie session and middleware protection"
```

---

## Task 4: Auto-Save Lead on Detail Page View

**Files:**
- Create: `app/api/pipeline/leads/route.ts`
- Modify: `app/lead/[placeId]/page.tsx`

- [ ] **Step 1: Create the pipeline leads API route**

```typescript
// app/api/pipeline/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: fetch all pipeline leads, newest first
export async function GET() {
  const { data, error } = await supabase
    .from("pipeline_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data });
}

// POST: upsert a lead by place_id (called from detail page on load)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { place_id, business_name, address, phone, rating, review_count, category, city } = body;

  if (!place_id || !business_name) {
    return NextResponse.json({ error: "place_id and business_name are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pipeline_leads")
    .upsert(
      { place_id, business_name, address, phone, rating, review_count, category, city },
      { onConflict: "place_id", ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

// PATCH: update status and/or notes for a lead by id
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, notes } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase
    .from("pipeline_leads")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
```

- [ ] **Step 2: Add auto-save to the lead detail page**

Find the existing `export default async function LeadDetailPage` in `app/lead/[placeId]/page.tsx`. Add the upsert call right after `getLeadDetail` succeeds:

```typescript
// app/lead/[placeId]/page.tsx
// Add this import at the top:
import { supabase } from "@/lib/supabase";

// Inside LeadDetailPage, after: const lead = await getLeadDetail(params.placeId);
// and before: if (!lead) { ...
// Add:
  if (lead) {
    // Auto-save to pipeline on first view — upsert ignores if already exists
    await supabase.from("pipeline_leads").upsert(
      {
        place_id: params.placeId,
        business_name: lead.name,
        address: lead.address,
        phone: lead.phone ?? "",
        rating: lead.rating,
        review_count: lead.reviewCount,
        category: lead.category ?? "",
        city: lead.address.split(",")[1]?.trim() ?? "",
      },
      { onConflict: "place_id", ignoreDuplicates: true }
    );
  }
```

- [ ] **Step 3: Smoke test auto-save**

1. Start dev server: `npm run dev`
2. Search for a business and click into its detail page
3. Go to Supabase dashboard → Table Editor → `pipeline_leads`
4. Verify a row was created with the correct place_id, business_name, status = 'new'
5. Click the same lead again — verify no duplicate row created (upsert ignores)

- [ ] **Step 4: Commit**

```bash
git add app/api/pipeline/leads/route.ts "app/lead/[placeId]/page.tsx" lib/supabase.ts
git commit -m "feat: auto-save lead to pipeline_leads on detail page view"
```

---

## Task 5: Lead Pipeline View Page

**Files:**
- Create: `app/pipeline/page.tsx`
- Create: `app/pipeline/PipelineClient.tsx`

- [ ] **Step 1: Create the server component**

```typescript
// app/pipeline/page.tsx
import { supabase } from "@/lib/supabase";
import PipelineClient from "./PipelineClient";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { data: leads, error } = await supabase
    .from("pipeline_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-f10-bg p-8">
        <p className="font-body text-red-500">Failed to load pipeline: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-f10-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-heading text-3xl text-f10-text mb-2">Lead Pipeline</h1>
        <p className="font-body text-sm text-gray-400 mb-8">{leads?.length ?? 0} leads tracked</p>
        <PipelineClient initialLeads={leads ?? []} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the client component**

```typescript
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
```

- [ ] **Step 3: Smoke test pipeline view**

1. Navigate to http://localhost:3000/pipeline
2. Verify leads appear from prior smoke test
3. Change a lead status via the dropdown — verify it saves (check Supabase table)
4. Add a note and click away — verify it saves
5. Mark a lead "closed" — verify "Create Client" button appears

- [ ] **Step 4: Commit**

```bash
git add app/pipeline/page.tsx app/pipeline/PipelineClient.tsx
git commit -m "feat: add lead pipeline view with inline status and notes editing"
```

---

## Task 6: Client Records

**Files:**
- Create: `app/api/pipeline/clients/route.ts`
- Create: `app/clients/page.tsx`
- Create: `app/clients/ClientsClient.tsx`

- [ ] **Step 1: Create the clients API route**

```typescript
// app/api/pipeline/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lead_id, business_name, contact_phone } = body;

  if (!business_name) {
    return NextResponse.json({ error: "business_name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      lead_id: lead_id ?? null,
      business_name,
      contact_phone: contact_phone ?? "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = ["contact_name","contact_email","contact_phone","sku","payment_status","provisioning_status","go_live_date","notes"];
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const { data, error } = await supabase
    .from("clients")
    .update(filtered)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}
```

- [ ] **Step 2: Create the clients server component**

```typescript
// app/clients/page.tsx
import { supabase } from "@/lib/supabase";
import ClientsClient from "./ClientsClient";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-f10-bg p-8">
        <p className="font-body text-red-500">Failed to load clients: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-f10-bg p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-heading text-3xl text-f10-text mb-2">Active Clients</h1>
        <p className="font-body text-sm text-gray-400 mb-8">{clients?.length ?? 0} clients on record</p>
        <ClientsClient initialClients={clients ?? []} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create the clients client component**

```typescript
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
    }
    setSaving(null);
  }

  return (
    <div className="bg-white rounded-f10 border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm font-body">
        <thead className="bg-f10-tint border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Business</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">SKU</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Payment</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Provisioning</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Go Live</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-f10-text">{client.business_name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{client.contact_email || client.contact_phone || "No contact yet"}</div>
              </td>
              <td className="px-4 py-3">
                <select
                  value={client.sku}
                  onChange={(e) => updateClient(client.id, { sku: e.target.value })}
                  disabled={saving === client.id}
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
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${PAYMENT_COLORS[client.payment_status]}`}
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
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${PROVISIONING_COLORS[client.provisioning_status]}`}
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
  );
}
```

- [ ] **Step 4: Smoke test client records**

1. Go to http://localhost:3000/pipeline
2. Change a lead's status to "closed" — verify "Create Client" button appears
3. Click "Create Client" — verify alert fires
4. Go to http://localhost:3000/clients — verify client row appears
5. Update provisioning status to "in_progress" — verify saves
6. Add a go-live date — verify saves

- [ ] **Step 5: Commit**

```bash
git add app/api/pipeline/clients/route.ts app/clients/page.tsx app/clients/ClientsClient.tsx
git commit -m "feat: add client records page with inline editing"
```

---

## Task 7: Navigation Bar

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add nav to layout**

Open `app/layout.tsx` and add a nav bar inside the body, before `{children}`:

```typescript
// Add inside <body>, before {children}:
<nav className="bg-white border-b border-gray-100 px-8 py-3 flex items-center justify-between">
  <a href="/" className="font-heading text-lg text-f10-primary font-semibold">
    F10 Strategy
  </a>
  <div className="flex items-center gap-6">
    <a href="/" className="font-body text-sm text-gray-600 hover:text-f10-primary transition-colors">
      Search
    </a>
    <a href="/pipeline" className="font-body text-sm text-gray-600 hover:text-f10-primary transition-colors">
      Pipeline
    </a>
    <a href="/clients" className="font-body text-sm text-gray-600 hover:text-f10-primary transition-colors">
      Clients
    </a>
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className="font-body text-sm text-gray-400 hover:text-gray-600 transition-colors">
        Sign Out
      </button>
    </form>
  </div>
</nav>
```

- [ ] **Step 2: Smoke test navigation**

1. Visit http://localhost:3000 — nav bar appears on all pages
2. Click Pipeline — navigates correctly
3. Click Clients — navigates correctly
4. Click Sign Out — redirects to login page

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add nav bar with Search, Pipeline, Clients, Sign Out"
```

---

## Task 8: Subdomain + Production Deploy

**Files:** No code changes — DNS + Vercel config only.

- [ ] **Step 1: Add SITE_PASSWORD to Vercel production**

```bash
vercel env add SITE_PASSWORD production
# Enter your chosen password when prompted
```

- [ ] **Step 2: Deploy to Vercel**

```bash
git push
```

Wait for Vercel build to complete. Check dashboard for any build errors.

- [ ] **Step 3: Add custom domain in Vercel**

1. Go to Vercel dashboard → f10-leadgen-demo project → Settings → Domains
2. Add `app.f10strategy.com`
3. Copy the CNAME record Vercel provides (e.g., `cname.vercel-dns.com`)

- [ ] **Step 4: Add DNS record in Cloudflare**

1. Log into Cloudflare → f10strategy.com domain → DNS
2. Add a CNAME record:
   - Name: `app`
   - Target: the value Vercel gave you
   - Proxy: OFF (DNS only, gray cloud)
3. Save

- [ ] **Step 5: Verify domain is live**

Wait 2 to 5 minutes, then:
```bash
curl -I https://app.f10strategy.com
```
Expected: `HTTP/2 200` or `HTTP/2 302` (redirect to login). If still propagating, wait and retry.

- [ ] **Step 6: End-to-end smoke test on production**

1. Open https://app.f10strategy.com — redirects to login
2. Sign in with production password — lands on Search page
3. Search for a business, click into it — verify lead appears in Pipeline
4. Change lead status — verify saves
5. Mark a lead closed, create client — verify appears in Clients
6. Sign out — back to login

- [ ] **Step 7: Final commit**

```bash
git commit --allow-empty -m "deploy: Tier 1 complete — app.f10strategy.com live"
```

---

## Self-Review Checklist

- [x] Auth: login page, cookie, middleware, logout all covered
- [x] Auto-save: lead saved to Supabase on detail page view
- [x] Pipeline: GET, PATCH status/notes, display table, inline edit
- [x] Client records: POST on close, PATCH updates, display table
- [x] Nav: links to all three pages + sign out
- [x] Subdomain: Vercel + Cloudflare DNS steps
- [x] No TBD or TODO placeholders
- [x] All types consistent across tasks (PipelineLead, Client interfaces match Supabase columns)
- [x] SITE_PASSWORD added to both .env.local and Vercel production
- [x] Sabrina note preserved in spec — no pricing numbers in any component
- [x] Supabase env vars already present in .env.local — confirmed in Task 2
