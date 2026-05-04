# F10 Strategy Platform — Production Build Design
**Date:** 2026-05-04
**Status:** Approved by Efton Geary
**Brand:** F10 Strategy (f10strategy.com)
**Future Product Brand:** AOS — AI Operator Systems (launches Month 3)

---

## What We Are Building

A production platform that turns the existing F10 lead gen demo into a real sales and delivery tool for the F10 Strategy consulting brand. The platform is sold three ways: Done For You (DFY), Done With You (DWY), and White Label agency licensing.

The current demo is already functional for prospecting and demonstrating. The production build adds login, lead pipeline tracking, client records, and a permanent home at app.f10strategy.com.

---

## Strategic Context

### Brand Architecture (Advisory Council — Option C)
- **F10 Strategy** closes DFY and DWY clients now under the existing brand
- **AOS (AI Operator Systems)** launches as a separate product brand after 60 to 90 days of documented F10 Strategy client results
- F10 Strategy is not a liability to AOS — it is AOS's most compelling proof point
- Both brands share the same backend infrastructure

### Build Sequence (Advisory Council — Option C)
- **Tier 1 (Week 1 to 2):** Auth, pipeline CRM, client records, subdomain — close first DFY clients
- **Tier 2 (Week 3 to 4):** Stripe billing, multi-rep logins, basic client portal — close DWY clients
- **Tier 3 (Week 5 to 8):** White label layer, agency portal, automated provisioning — close agency deals

### Delivery Model (Advisory Council — Concierge MVP)
- Charge full price from Day 1
- Efton directs, Claude Code executes — one client at a time
- Document every provisioning step as a runbook during clients 1 through 5
- Automate when the runbook is stable across 3 clients with no deviation

### Go-To-Market (Three Channels)
- **Walk-in:** Show up with their business loaded in the demo. In-person shock factor closes rooms.
- **Personalized video:** 90-second screen recording showing their business in the system, sent via LinkedIn or email
- **Live demo link:** Send the link, ACE follows up automatically until they book

---

## System Architecture

Four layers, stacked:

### Layer 1 — Frontend (Vercel + Next.js)
The tool Efton uses daily. Lead search, business profiles, live demo launcher, proposal sender, pipeline CRM view. Password-protected. F10 Strategy brand. Lives at app.f10strategy.com.

### Layer 2 — API Routes (Next.js + Node)
Google Places search, Claude AI snapshots, ElevenLabs agent creation, Resend proposal emails, ACE follow-up triggers. Already built and working.

### Layer 3 — Data (Supabase)
Lead pipeline table, client records, provisioning status, ACE follow-up log, Revenue Rescue metrics. Single source of truth for all pipeline data.

### Layer 4 — Delivery (n8n + ElevenLabs + Claude)
Revenue Rescue workflow. Configured per client by Efton and Claude Code. Handles the client's inbound leads, follow-up, and ROI reporting. Manual for clients 1 through 5, then automated.

---

## Data Flow — Full Pipeline (7 Stages)

| Stage | Action | Status |
|-------|--------|--------|
| 1 | Efton searches a city and business type. Google Places returns results. Lead record created in Supabase. | New |
| 2 | Efton clicks the lead. Claude generates a snapshot — pain points, pitch angle, missed follow-up opportunities. | Reviewed |
| 3 | Live ElevenLabs voice demo runs — in person, via video, or via shareable link. Agent uses real business data. | Demoed |
| 4 | Branded proposal sent via Resend. ACE begins automated follow-up sequence until prospect responds or books. | Proposal Sent |
| 5 | Prospect books a call. Efton closes. Sabrina handles pricing. Client signs and pays. Client record created. | Closed |
| 6 | Efton + Claude Code configure client's Revenue Rescue: ElevenLabs agent, Supabase tables, n8n workflow. Live in 48 hours. | Active |
| 7 | Client's AI handles their inbound. Monthly metrics report sent. Client sees ROI. Renewal is a no-brainer. | Recurring |

Stages 1 through 5 are already built. Stages 6 and 7 complete the pipeline in Tier 1.

---

## Tier 1 Components (Week 1 to 2)

### Component 1 — Login / Auth
Simple password-protected login at app.f10strategy.com. Uses a hardcoded environment variable password to start — no database user accounts needed in Tier 1. One password, one tool. Upgrade to Supabase auth in Tier 2 when reps need individual logins.

### Component 2 — Lead Pipeline View
Table or kanban board showing all leads by status: New, Reviewed, Demoed, Proposal Sent, Closed, Active, Recurring. Click any lead to open their full profile. Update status with one click. Notes field per lead. All data saves to Supabase.

### Component 3 — Client Records
When a lead is marked Closed, a client record is created in Supabase. Tracks: business name, contact info, SKU (DFY or DWY), payment status, provisioning status, go-live date, and monthly metrics summary.

### Component 4 — Subdomain
Point app.f10strategy.com at the Vercel deployment via Cloudflare DNS. Add custom domain in Vercel project settings. One-time setup, approximately 20 minutes.

### What Is NOT in Tier 1
- Stripe billing (Tier 2)
- Client-facing portal (Tier 2)
- Multi-rep logins (Tier 2)
- White label layer (Tier 3)
- Agency dashboard (Tier 3)
- Automated provisioning (Tier 3)

---

## Error Handling & Monitoring

### What Can Break
- **Google Places API** — quota hit or key expired. Lead search returns empty.
- **ElevenLabs agent** — voice demo fails to launch or disconnects mid-call.
- **Resend email** — proposal fails to send. Client never gets the proposal.
- **Supabase** — write fails. Lead status not saved. Pipeline out of sync.
- **Revenue Rescue n8n** — client's follow-up workflow stalls. Leads fall through.

### How We Catch It
- **VERA via Telegram** — API errors and n8n failures trigger an immediate alert
- **Vercel logs** — every API route error is captured and reviewable
- **Supabase dashboard** — live table view confirms data is writing correctly
- **n8n execution log** — every workflow run is logged; failed runs are immediately visible
- **30-day concierge window** — for clients 1 through 5, Efton manually checks each client's workflow weekly

### Break Protocol
1. **Contain** — if the client is affected now, pause their n8n workflow immediately and send a manual message to cover the gap
2. **Diagnose** — check Vercel logs, n8n execution log, and Supabase in that order. Identify which layer failed. Efton and Claude Code investigate and fix.
3. **Document** — add the failure to the runbook: what broke, what caused it, what fixed it

### Client-Facing SLA
"I personally monitor your system weekly and am available if anything needs attention." No uptime percentage guarantee. The human backstop is more reassuring to a small business owner than any SLA document.

---

## Provisioning Runbook (Built During Clients 1 through 5)

Each client provisioning session will be documented step-by-step. The runbook captures:
- ElevenLabs agent configuration (voice, personality, business context)
- Supabase table setup for the client's lead data
- n8n workflow activation and webhook wiring
- Test run verification (one inbound lead handled end-to-end)
- Client go-live confirmation

Automation of provisioning begins when the runbook is stable across 3 consecutive clients with no deviations.

---

## Pricing Reference
Per standing rule, Sabrina Geary owns all pricing conversations. No pricing numbers appear in client-facing materials without her present.

---

## SKUs
- **Done For You (DFY)** — F10 runs the full pipeline. Highest margin, most hands-on.
- **Done With You (DWY)** — Client self-serves on the platform. Monthly SaaS fee. Lower touch, more scale.
- **White Label** — Agency gets the platform under their own brand. Recurring platform fee.

---

## Next Steps (Tier 1 Build)
1. Add password-protected login to the existing Next.js app
2. Create Supabase tables: `leads` (with status column) and `clients`
3. Build pipeline view page (table or kanban, status updates, notes)
4. Build client records page (created on close, tracks provisioning status)
5. Point app.f10strategy.com at the Vercel deployment
6. Test end-to-end: search a lead, move it through all statuses, create a client record
7. Walk-in demo ready — Tier 1 complete
