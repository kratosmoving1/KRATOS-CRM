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

## ✅ Done (Session 8 — Editable Templates + Smart Textarea + Delete Customer)

- Call composer: picking an SMS template populates an editable textarea pre-filled with interpolated body (no {{tokens}}). Agent edits before Log Call. Edited body sent to Twilio.
- Call composer: email template picker shows editable subject + body editors stacked below the dropdowns.
- Call composer: textarea is adaptive — notes textarea when no template picked, SMS/email editors when templates are picked, notes textarea hidden to reduce clutter.
- Customer detail page: Delete Customer button + confirmation modal. Shows real counts of linked quotes/communications. Cascade soft-deletes customer + opportunities + communications. Audit logged.
- follow_ups NOT cascaded (live DB has no customer_id/opportunity_id columns — confirmed via REST).

## ✅ Done (Session 7 — Opportunity Page Final Polish + Inbound SMS)

- Opportunity detail page redesign complete: hero header, contact row, activity cards, sidebar card shells with icons
- Inbound SMS webhook at `/api/webhooks/twilio/sms` — replies auto-appear in activity feed as "Incoming SMS" cards
- Activity cards unified: all item types (notes, SMS, email, calls, follow-ups, audit events) render as bordered cards with colored icon badges
- Quote created card: FilePlus icon, orange badge, full `p-4` padding matching SMS cards
- Sidebar: Next Follow-up / Information / Stops / Opportunity Details each have icon + proper title header

---

## ✅ Done (Session 12 — Estimate Tab Bug Sweep)

- Tier switching: all 4 cards always clickable, including the applied one ("Applied · Re-apply" pattern)
- Stale rate: apply-package is idempotent — every click overwrites `hourly_rate` with the live rate from `getRateForDate()`; no skip optimization
- PACKAGE hero card: now reads `config.tier_id` → `PACKAGE_TIERS.find()` for tier label; shows `$X.XX/hr` from `config.hourly_rate`
- Job Summary section deleted: was duplicative with Charges table row, caused $169.99 vs $189.99 drift
- `console.log('[apply-package]', ...)` added for Vercel log verification; remove once confirmed working
- Deleted dead code: `packageDisplayName()` function, `numTrucks`/`numCrew`/`billableHours`/`travelHours`/`loadHours`/`unloadHours`/`bufferHours`/`hasLaborCharge` local vars

## ✅ Done (Session 11 — Estimate Tab Refactor + Tier Switching Fix)

- **Bug fix:** Tier switching — Apply buttons on non-active tier cards remain fully clickable after a tier is applied. Root cause: `disabled={applyingId !== null || isApplied}` changed to two separate button elements.
- **UI refactor:** "Main Package" section deleted. "Supplementary Charges" section deleted. Both replaced by a single unified "Charges" table.
- All charges (Moving Labor + supplementary) appear as rows in one table with columns: Name / Rate / Subtotal / Discount / Total.
- Rate column formatted by `lib/charges/format.ts → formatRate()`: `3h @ $189.99/hr (1 truck, 2 crew)` pattern.
- Estimated Total footer row in `<tfoot>` replaces the old "Charges Total" line.
- Collapse toggle on the Charges header.
- Moving Labor row has Edit + Delete in three-dot menu (no Duplicate — matches existing API behavior).
- Files changed: `components/admin/charges/PackageTierCards.tsx`, `components/admin/charges/ChargesSection.tsx`, `lib/charges/format.ts` (new)

## ✅ Done (Session 10 — Document Templates Library Phase 1A)

- `document_templates` table with categories, draft/published status, soft-delete, auto-updated_at trigger
- Settings → Documents grid page: 4-column card layout, category badge, Modified/Published dates, three-dot menu (Edit, Duplicate, Delete)
- Empty state with "+ Create your first template" CTA
- TipTap rich text editor with full toolbar: Bold, Italic, Underline, Strikethrough, H1/H2/H3, Lists, Blockquote, Code, HR, Link, Image, Table, Text Align, Undo/Redo
- Merge field picker side panel: 42 fields across 8 groups (Customer, Opportunity, Addresses, Package, Charges, Agent, Company, Document); live search filter; click to insert at cursor
- Merge fields render as styled orange monospace pills (`.kratos-merge-field` CSS class)
- Template form: Name, Category, Description, Draft/Published status; Save/Cancel/Delete
- New template page at `/admin/settings/documents/new`
- Edit template page at `/admin/settings/documents/[id]`
- API routes: GET/POST list, GET/PATCH/DELETE single, POST duplicate
- 5 seed templates: Estimate, Contract, Invoice, Damage Waiver, Work Order (run `npm run seed:documents` after SQL migration)
- Settings nav and settings home page updated with "Document Templates" entry
- `@tailwindcss/typography` installed; `prose prose-sm` applied to editor
- **Seed method:** `npx tsx scripts/seed-document-templates.ts`

## ✅ Done (Session 9 — Multi-Tier Package Recommendation)

- Estimate tab → Package Recommendation card upgraded from 1-2 cards to 4 cards side by side
- Tiers: Bronze (0 trucks, 2 crew), Silver (1 truck, 2 crew), Gold (1 truck, 3 crew), Platinum (1 truck, 4 crew)
- Weekend/weekday rate detection per tier ($10 premium on weekends)
- Smart recommendation: correct tier highlighted "Recommended" based on move_size
- Click "Apply" on any card → `POST /api/admin/opportunities/[id]/apply-package` → creates or updates Moving Labor charge (no duplicates)
- "Applied" badge + ring border on the active tier — persists on page refresh
- Charges table and sidebar totals refresh automatically after apply
- Tier definitions live in `lib/packages/tiers.ts`; component at `components/admin/charges/PackageTierCards.tsx`

## ✅ Done (Dispatch Restructure + People Database)

- Sidebar: replaced top-level "Workforce" with "Dispatch" (Truck icon)
- New Dispatch layout at `/admin/dispatch` with Workforce + Calendar tabs
- Calendar tab: "Coming soon" placeholder
- Old `/admin/workforce` redirects to `/admin/dispatch/workforce`
- New tables: `workforce_locations` (5 seeded), `workforce_roles` (5 seeded)
- New columns on `workforce_people`: `role_id`, `location_id`, `english_proficiency`, `profile_picture_url`
- Supabase Storage bucket `workforce-photos` (public, 5MB, JPEG/PNG/WebP/GIF)
- People List View: grid of person cards with avatar, role, location, English, status, tier
- Add Person modal: all fields + profile picture upload (direct to Supabase Storage)
- Edit Person drawer: all fields + change photo + tenure/referred_by + explicit Save + delete confirm
- Filter bar: search + multi-select Role/Location/Status/Tier/English
- View toggle: List (default) | Board (existing kanban preserved at /board)
- API routes: locations (GET/POST), roles (GET/POST), people PATCH allowlist extended

## ✅ Done (Workforce Board Phase 1)

- New `workforce_columns`, `workforce_statuses`, `workforce_tiers`, `workforce_people` tables with triggers, indexes, RLS
- Seeded 3 statuses (Solid/Inconsistent/Problem) and 8 tiers (S/A/B/C/D/E/F/X)
- Sidebar entry "Workforce" with HardHat icon between Reports and Settings
- `/admin/workforce` Kanban board with drag-and-drop columns and cards (`@dnd-kit`)
- Create / rename / delete columns
- Create / delete people cards
- Inline edit: name, role, status (badge dropdown), tier (badge dropdown)
- All changes persist to Supabase via API routes
- API routes: board GET, columns CRUD + reorder, people CRUD + reorder

## 🔜 Dispatch next steps

- Settings page for editing/adding/deleting locations, roles, statuses, tiers taxonomies
- Dispatch Calendar (crew schedules and job assignments)
- Bulk select / bulk actions on people list
- "Unassigned" virtual column on kanban board for people with column_id = null
- Person performance metrics (jobs completed, hours, etc.)

## 🔧 Next

### Document Templates Phase 1B — Per-Opportunity Document Generation (next session)

- "Generate Document" button on opportunity Estimate tab → pick a template → preview rendered HTML with all merge fields replaced
- Server-side merge field substitution (replace `{{token}}` with real opportunity/customer data)
- Download as PDF (html-pdf or Puppeteer)
- "Send to Customer" via email (Resend)
- "Publish to Existing Jobs" button on template grid

## 🔧 Now (Tariff Configuration)

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
