# Kratos CRM — Roadmap

Tracks what's done, what's in progress, and what's coming next. Update this file at the end of every session.

The "Now" section is what the current session is working on. The "Next" section is what comes immediately after. Don't work ahead of the Next section without asking AJ.

---

## ✅ Done

### Session 1 — Foundation
- Next.js 14 + TypeScript + Tailwind + Supabase scaffold
- Initial database schema: `profiles`, `lead_sources`, `customers`, `opportunities`, `audit_log`
- Admin shell with sidebar nav, login page, auth middleware
- Dashboard with stat cards, activity card, sales leaders, top referral sources, 12-month revenue chart
- Seed data (5 sales agents, 80 customers, 250 opportunities)
- Deployed to Vercel at `kratos-crm.vercel.app`

### Session 2 — Core CRUD
- `+` button menu (New Opportunity, New Lead, New Task, New Follow-up)
- 3-step New Opportunity modal (Personal Info → Origin → Destination)
- Opportunities list page with filters, search, sort, pagination
- Opportunity detail page (initial)
- Customers list page
- Customer detail page
- Kratos warrior logo applied

### Session 3 — Refinement
- Migrated to 5-status model (`opportunity` / `booked` / `completed` / `closed` / `cancelled`)
- Status-change workflow with allowed-transitions logic and `ChangeStatusModal`
- Mandatory field set reduced to: name, phone, service_date, service_type, move_size
- Communications table (notes/calls/emails/SMS) and Sales tab on opportunity detail
- Estimate tab structure (metric cards, line-item charges table, totals sidebar)
- Customer detail page redesigned to match SmartMoving layout

### Session 4 — Address overhaul + estimate portal + payments + RingCentral

**Address fixes:**
- Added columns: `origin_city`, `dest_city`, `origin_place_id`, `dest_place_id`
- Replaced `use-places-autocomplete` + `@reach/combobox` (broken on React 18) with `@googlemaps/js-api-loader` v2 + custom dropdown
- New Opportunity modal Steps 2/3: single address search box + read-only confirmation line; no segmented city/province/postal inputs
- `PATCH /api/admin/opportunities/[id]` guarded by `ALLOWED_OPPORTUNITY_COLUMNS` allowlist in `lib/opportunityColumns.ts`

**Estimate portal:**
- `estimate_portal_links` table + `lib/estimates/portal.ts`
- "Send Estimate" button → dropdown → email/copy-link flow
- Customer-facing portal at `/portal/estimate/[token]` — shows estimate details
- Sign Estimate page at `/portal/estimate/[token]/sign` — typed name, agreement checkbox, submit
- `estimate_signatures` table stores signed name, timestamp, IP
- `POST /api/estimates/sign` validates token, records signature, sets `accepted_at`
- `POST /api/estimates/portal-link` generates token + sends email

**Payments:**
- `payments` table
- Record-only payment flow (cash, check, card, e-transfer, wire)
- Stripe Checkout integration (`/api/payments/stripe/checkout` + webhook)
- Payment drawer on Estimate tab with amount, date, reference, notes

**RingCentral:**
- Per-user OAuth flow (`/admin/settings` → "Connect RingCentral")
- Call button component: click-to-dial from opportunity header, customer cards
- SMS send from opportunity timeline
- Automatic call/SMS logging to `communications` table
- No-answer template flow: select SMS + email template, send both at once

**QuickEdit + address edit:**
- `QuickEditModal` (pencil icon on header) — name, phone, phone type, email only
- `PATCH /api/admin/opportunities/[id]/quick-edit` — updates `customers` table only
- Move date inline edit in Information card — calendar icon → TBD/date popover → `PATCH .../move-date`
- `EditAddressModal` (pencil icons in Trip Info) — AddressAutocomplete + dwelling/floor/stairs
- `PATCH /api/admin/opportunities/[id]/trip-info` — updates origin or dest address block

**Docs:**
- `SCHEMA.md`, `DECISIONS.md`, `ROADMAP.md` created
- `CLAUDE.md` upgraded with mandatory pre-flight rules

---

## ✅ Done (Session 5 — Communications & Customer Creation Fixes)

- **Bug 1 (Create Customer)**: New Customer modal added to + create menu. POST /api/admin/customers route created. Existing-customer picker added to New Quote modal step 1.
- **Bug 2 (SMS "Opportunity not found")**: Root cause was `.eq('is_deleted', false)` matching only explicit `false`, not NULL. Fixed to `.neq('is_deleted', true)` in SMS send route and findOrCreateCustomer.
- **Bug 3 (Activity timeline)**: Same is_deleted NULL bug in timeline communications query fixed. Timeline already had the correct merged architecture (communications + audit_log + follow_ups).

---

## ✅ Done (Session 7 — Opportunity Page Final Polish + Inbound SMS)

- Opportunity detail page redesign complete: hero header, contact row, activity cards, sidebar card shells with icons
- Inbound SMS webhook at `/api/webhooks/twilio/sms` — replies auto-appear in activity feed as "Incoming SMS" cards
- Activity cards unified: all item types (notes, SMS, email, calls, follow-ups, audit events) render as bordered cards with colored icon badges
- Quote created card: FilePlus icon, orange badge, full `p-4` padding matching SMS cards
- Sidebar: Next Follow-up / Information / Stops / Opportunity Details each have icon + proper title header

---

## 🔧 Now

_Tariff Configuration UI in Settings_

- New "Tariffs" section in Settings — AJ inputs real pricing rules
- Hourly rate matrix: crew size × move size × distance bracket
- Estimate generation pulls from selected tariff and populates Estimate tab line items automatically

## ✅ Done (Session 6 — Opportunity Detail Page Visual Redesign)

- **Header**: Customer name now 2xl bold. Phone + email contact row sits directly under the name with clickable tel:/mailto: links. Pencil edit icon inline next to name. Meta row shows service type, date, move size, quote number.
- **Sidebar**: Next Follow-up card added as the first sidebar card (pulls from live timeline state). Information card gains Branch, Estimator, Move Coordinator, Lead Status rows (hardcoded placeholders pending schema columns). 
- **Activity**: Timeline items converted from plain rows to white bordered cards with colored icon chips per activity type (amber=note, purple=SMS, blue=email, green=call, orange=follow-up, slate=audit). Generic "Details updated" audit events filtered out entirely. CommTypeIcon extended to handle all type keys.

---

## 🔜 Next

### Tariff configuration + automatic pricing engine
- New "Tariffs" section in Settings — AJ inputs his real pricing rules
- Hourly rate matrix: crew size × move size × distance bracket
- Material costs (boxes, wrap, etc.)
- Travel time fee logic
- Long-distance pricing (per-mile or per-weight)
- Estimate generation: pulls from selected tariff, populates Estimate tab line items automatically
- Manual line-item override allowed

### Follow-ups dashboard
- `/admin/follow-ups` — today's follow-ups, overdue, by agent
- Mark-complete action inline
- Create follow-up from opportunity detail (already has modal; needs the list page)

---

## 📦 Later (planned, not started)

### Native invoicing + accounting tab
- Invoice generation from completed jobs
- Per-opportunity Accounting tab: revenue line items, cost line items, gross profit, net profit
- Per-opportunity Profitability tab: actual vs estimated cost analysis

### Email sending via Resend
- Currently communications are logged to DB but outbound email isn't actually sent
- Wire Resend (or similar) to the `sms`/`email` send flow
- Template variable substitution (customer name, move date, etc.)

### Operations
- Dispatch board (drag-and-drop schedule view by date)
- Crew app (mobile PWA — assign jobs, mark complete, upload photos)
- Telegram bot for crew notifications

### Intelligence
- AI call summarization (transcribe → summarize → tag outcome)
- AI lead scoring (likelihood to close based on historical patterns)
- Dashboards: cohort analysis, source ROI, agent performance deep dives

---

## 🚫 Not in scope (deferred indefinitely)

- Multi-company / multi-tenant UI separation (`company_id` placeholder exists; logic doesn't)
- Franchise / owner-operator support
- Real-time subscriptions (Supabase Realtime)
- Replicating every SmartMoving feature 1:1 — only the ones Kratos actually uses
- GraphQL — REST only
- Microservices — monolith only
