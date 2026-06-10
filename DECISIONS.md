# Kratos CRM — Architectural Decisions Log

Append-only log of decisions made about the project. Each entry: date, decision, reasoning, alternatives considered.

Don't edit old entries. If a decision is reversed, add a new entry that supersedes the old one.

---

## 2026-01 — Stack: Next.js + Supabase, not Salesforce

**Decision:** Build Kratos CRM on Next.js (App Router) + TypeScript + Supabase Postgres. Drop Salesforce.

**Reasoning:**
- Salesforce was being attempted but kept blocking AJ on platform-specific bugs (Quick Action rendering, Apex friction)
- Salesforce licensing is $150–300/user/month at scale — too expensive for a moving company
- Salesforce is optimized for B2B sales orgs, not operations-heavy field work
- Next.js stack matches AJ's skill curve and allows fast iteration via Claude Code

**Alternatives considered:**
- Salesforce — abandoned (above)
- Retool / Appsmith — too limiting for customer-facing portals later
- Extending SmartMoving — doesn't get AJ data ownership

---

## 2026-01 — Database: Supabase Postgres, schema changes via SQL Editor only

**Decision:** The hosted Supabase Postgres database is the authoritative source of truth for schema. Schema changes are run by AJ pasting SQL into the Supabase SQL Editor, not via local migration files.

**Reasoning:**
- Local migration files repeatedly drifted from hosted schema during sessions 1–3
- Supabase CLI `db push` requires login setup AJ doesn't always have available
- Pasting SQL into the editor is the simplest, most reliable path
- `types/database.ts` regenerated from the live DB stays in sync automatically

**Alternatives considered:**
- Pure migration-file workflow with `supabase db push` — kept breaking due to drift
- Drizzle ORM with its own migration system — adds complexity, AJ isn't familiar

**Implication:** Any AI tool that generates a new migration file in `supabase/migrations/` is violating this decision. SQL goes inline in chat for AJ to paste.

---

## 2026-02 — Status model: 5 statuses, not 8

**Decision:** Opportunity statuses are: `opportunity`, `booked`, `completed`, `closed`, `cancelled`.

Older 8-status model (`new_lead`, `contacted`, `quote_sent`, `accepted`, `booked`, `completed`, `cancelled`, `lost`) has been migrated. The 5-status model maps to how Kratos actually operates:
- `opportunity` — inquiry stage
- `booked` — scheduled in
- `completed` — job done, accounting not finalized
- `closed` — job done AND accounting closed
- `cancelled` — customer cancelled

**Reasoning:** AJ's real-world workflow has 5 stages, not 8. Granular Salesforce-style pipelines aren't useful for a moving company.

**Allowed transitions:**
- `opportunity` → `booked` or `cancelled`
- `booked` → `completed` or `cancelled`
- `completed` → `closed` or `cancelled`
- `closed` → terminal
- `cancelled` → can reopen to `opportunity`

---

## 2026-02 — Authentication: Supabase Auth with email + password

**Decision:** Supabase Auth for all auth, both staff (admin app) and (eventually) customers (portal). Email + password; magic links available.

**Reasoning:** Built-in, free at this scale, integrates natively with RLS, no separate auth provider to manage.

---

## 2026-03 — Address autocomplete: @googlemaps/js-api-loader v2, NOT use-places-autocomplete

**Decision:** Use `@googlemaps/js-api-loader` v2 (`setOptions` + `importLibrary('places')`) with a fully custom-built dropdown. Do not use `use-places-autocomplete` or `@reach/combobox`.

**Reasoning:**
- `@reach/combobox` (and the broader Reach UI project) are abandoned — no React 18 support
- `use-places-autocomplete` depends on `@reach/combobox` — breaks on Vercel with React 18
- The combination caused repeated production failures (peer dependency conflicts)
- `@googlemaps/js-api-loader` v2 is the current Google-recommended approach
- Custom dropdown gives full control over blur/select race conditions

**Implication:** If you see `@reach/combobox` or `use-places-autocomplete` imported anywhere, remove them. The `AddressAutocomplete` component is at `components/ui/AddressAutocomplete.tsx` — use that.

**Key implementation details:**
- Uses `AutocompleteSuggestion.fetchAutocompleteSuggestions()` (async) — NOT the deprecated `AutocompleteService.getPlacePredictions()` callback
- Use `onMouseDown` (not `onClick`) on dropdown items to prevent blur-before-select race
- Add `autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}` on input to suppress Chrome autofill
- Module-level singleton (`loadPromise`) ensures script loads exactly once per page session

---

## 2026-03 — Address UX: single search box, not segmented city/province/postal fields

**Decision:** The New Opportunity modal (and any address edit flow) uses a SINGLE address search box per side, not separate fields for street / city / province / postal.

Google Places API selection auto-fills city, province, and postal code into hidden form state. A read-only confirmation line displays parsed details below the search box. "Apt / Unit / Suite" is a separate optional text field (Google doesn't capture unit numbers).

**Reasoning:** Asking users to retype data Google already knows is bad UX and a frequent source of save bugs. Segmented fields caused `city`, `province`, and `postal_code` to arrive as empty strings, leading to silent DB nulls.

---

## 2026-03 — Brand: Kratos orange #ffad33, lucide-react icons, no emoji

**Decision:** Primary accent color is `#ffad33`, Tailwind alias `kratos`. Logo at `public/logo.png`. Icons via `lucide-react`. No emoji anywhere in the UI. No cutesy language.

---

## 2026-04 — Column name discipline: SCHEMA.md is mandatory pre-flight

**Decision:** Before writing any Supabase query, every column name must be verified against `SCHEMA.md`. Column names may not be inferred, shortened, or invented.

**Reasoning:** Multiple sessions (3–5) produced broken save flows because AI tools guessed column names. Common examples: `origin_stairs` instead of `origin_stairs_count`, `origin_elevator` instead of `origin_has_elevator`, `origin_address_1` instead of `origin_address_line1`. These errors are invisible to TypeScript but fail at runtime (silent null or DB error).

**Implication:** `SCHEMA.md` must be read at the start of any session that touches the database. `lib/opportunityColumns.ts` (`ALLOWED_OPPORTUNITY_COLUMNS`) is the enforced allowlist for PATCH operations — only columns listed there can be written via the general update endpoint.

---

## 2026-04 — Two separate audit tables: audit_log vs audit_logs

**Decision:** Keep both `audit_log` and `audit_logs` tables. They serve different purposes and both are written to on every significant action.

- `audit_log` — lightweight, free-form JSON `diff`. Powers the in-app timeline feed on the opportunity detail page.
- `audit_logs` — structured, with full `old_data` / `new_data` snapshots, `ip_address`, `user_agent`. Written by `logAuditEvent()` in `lib/audit/logAuditEvent.ts`. For compliance/debugging.

**Reasoning:** The timeline UI needs a simple queryable log. The structured log is for audit trails when something goes wrong. Merging them would either bloat the UI queries or lose structured data.

---

## 2026-04 — QuickEdit modal scope: contact fields only

**Decision:** The pencil icon (QuickEdit) on the opportunity header edits ONLY customer contact identity: Full Name, Phone, Phone Type, Email. Nothing else.

Move date is edited inline in the Information card (calendar icon → date popover → `PATCH .../move-date`). Origin/destination addresses are edited via `EditAddressModal` (pencil icons in Trip Info → `PATCH .../trip-info`). Estimate fields stay in the Estimate tab.

**Reasoning:** "Quick edit" means a single-purpose, low-friction flow. Mixing contact fields with move logistics fields in one modal causes UX confusion and API scope creep. Each concern gets its own minimal edit surface.

---

## 2026-06 — is_deleted filter: use .neq('is_deleted', true) not .eq('is_deleted', false)

**Decision:** All Supabase queries filtering soft-deleted rows must use `.neq('is_deleted', true)` not `.eq('is_deleted', false)`.

**Reasoning:** Postgres treats NULL as neither true nor false. `.eq('is_deleted', false)` silently excludes rows where `is_deleted IS NULL` (which happens for records inserted before a DEFAULT FALSE was enforced). `.neq('is_deleted', true)` correctly includes both `false` and `null` rows.

**Implication:** Any new query that filters `is_deleted` must use `.neq('is_deleted', true)`. This was the root cause of "Opportunity not found" in the SMS send route (session 5).

---

## 2026-06 — Customers are the parent entity; opportunities are children

**Decision:** Customers exist independently of opportunities. A customer can be created without any quote attached. The + Create menu offers "New Customer" as a standalone flow. The New Quote modal supports picking an existing customer OR creating a new one.

**Reasoning:** The previous flow required creating a quote to capture a lead, forcing every new contact to have a fake opportunity. This produced bad data (contacts with no real move intent cluttering the opportunity pipeline). Customers are now the root entity.

**Implication:** POST /api/admin/customers exists for standalone customer creation. The New Quote modal has an "Existing customer / New customer" toggle at the top of step 1.

---

## 2026-06 — Package Recommendation: 4 tiers (Bronze/Silver/Gold/Platinum), direct API apply

**Decision:** The Package Recommendation card on the Estimate tab shows four tiers side-by-side. Clicking "Apply" on any tier calls `POST /api/admin/opportunities/[id]/apply-package` directly with `{ tier_id }`, which inserts or updates the Moving Labor charge without opening the ChargeSidePanel.

**Tier rates (CAD, per hour):**
| Tier | Trucks | Crew | Weekday | Weekend |
|---|---|---|---|---|
| Bronze | 0 | 2 | $129.99 | $139.99 |
| Silver | 1 | 2 | $189.99 | $199.99 |
| Gold | 1 | 3 | $229.99 | $239.99 |
| Platinum | 1 | 4 | $259.99 | $269.99 |

**Recommendation logic:** `lib/packages/tiers.ts` → `recommendTier(moveSize)` iterates PACKAGE_TIERS in order and returns the first tier whose `recommended_for` array contains the move_size. Falls back to Silver if no match.

**Applied-tier detection:** `detectAppliedTier(config)` matches by `num_trucks + num_crew` against the Moving Labor charge config stored in `opportunity_charges.config`.

**Apply route deduplication:** `POST apply-package` checks for an existing `moving_labor` charge via `.neq('is_deleted', true)`. If found, updates it in-place (same row ID). If not found, inserts a new row. Prevents duplicate Moving Labor charges.

**Definitions live in:** `lib/packages/tiers.ts` — single source of truth for tier rates, crew, and recommendation mapping.

## 2026-06 — Document Templates: TipTap editor, inline merge field spans (Phase 1A)

**Decision:** Document template editing uses TipTap (not Lexical or Slate). Merge fields are styled inline `<span>` elements (not atomic ProseMirror nodes) for Phase 1A.

**TipTap rationale:**
- TipTap is React-first, has excellent TypeScript support, and a simple `useEditor` hook
- Extensions are composable and well-documented
- Compared to Lexical (Facebook's editor): TipTap has significantly simpler plugin API and better maintained community extensions
- The `insertContent(html)` method makes merge-field insertion trivial

**Merge field spans (not atomic nodes) for Phase 1A:**
- Merge fields are inserted as `<span class="kratos-merge-field" data-merge-field="token">{{token}}</span>`
- Users delete them character-by-character with backspace (acceptable trade-off)
- Phase 2+ can upgrade to custom atomic `MergeField` ProseMirror nodes for better UX (select-to-delete, non-editable pills)
- Inline spans survive HTML round-trips correctly — no serialization issues

**Content storage:**
- `content_html` — the primary content column. Rendered server-side when generating documents (Phase 1B).
- `content_json` — TipTap JSON representation stored alongside for editor re-hydration. Not used for rendering.

**Seed method:** `npx tsx scripts/seed-document-templates.ts` — uses service role key directly. Safe to re-run (skips existing templates by name+category).

## 2026-06 — Estimate tab: single unified Charges table (no Main Package section)

**Decision:** The Estimate tab uses one unified "Charges" table for all line items. The Moving Labor charge created by a package tier renders as a regular row — not in a separate "Main Package" section.

**Reasoning:**
- Matches SmartMoving's UX (reference product): one table, one mental model
- Simpler for agents: no need to scan two sections to see the full cost picture
- Single source of truth — the table renders exactly what's in `opportunity_charges`, no derived state
- The old "Main Package" card grid (with Trucks/Movers/Rate/Hours breakdown cards) was duplicating data already visible in the RATE column

**Applied pattern:**
- NAME column: `charge.name` (e.g. "Silver Package — Moving Labor") + charge type label below
- RATE column: formatted by `lib/charges/format.ts → formatRate()`, e.g. `3h @ $189.99/hr (1 truck, 2 crew)`
- Estimated Total row in `<tfoot>` — replaces the old "Charges Total" footer

**Tier switching fix:**
- The Apply button on non-applied tier cards must remain clickable after another tier is applied
- Root cause was `disabled={applyingId !== null || isApplied}` — now split into two separate button elements: one disabled green "Applied" for the active tier, one fully interactive "Apply" for all others
- Only the in-flight card (the one being applied) shows "Applying..." and is briefly disabled

## 2026-06 — Estimate tab bug sweep: single source of truth, idempotent apply, no Job Summary

**Decisions:**

1. **Removed Job Summary section from Estimate tab.** Single source of truth for crew/rate/hours is the Moving Labor row in `opportunity_charges`. The Job Summary section duplicated this data from the same config object but was read independently, causing drift when the rate changed. Deleted entirely.

2. **Apply-package is idempotent — every click refreshes the stored rate.** There is no "skip if same tier" optimization. Every click to `POST /apply-package` overwrites the Moving Labor charge config with the current tier's rate from `getRateForDate(tier, opp.service_date)`. This handles: legacy data with wrong rates, pricing updates without manual cleanup, and re-apply as a quick "force refresh".

3. **PACKAGE hero card reads from `config.tier_id` (then falls back to `detectAppliedTier`).** The card shows `tier.label` (e.g., "Silver") and `config.hourly_rate` formatted as `$X.XX/hr`. Not from a separate field on the opportunity. Not from a derived calculation. From the stored Moving Labor charge.

4. **Tier cards always clickable — "Applied · Re-apply" pattern.** The previously-applied tier card shows a green "Applied · Re-apply" button that is fully clickable. Only `applyingId === tier.id` (the in-flight card) briefly disables its button. This fixes the UX where agents couldn't switch tiers or force-refresh the rate.

## 2026-06 — Tier picker: whole-card clickable button, toggle behavior, saturated tier colors

**Decision:** The tier recommendation card is a single `<button>` element (the entire card). No nested button inside. Clicking anywhere on the card triggers selection.

**Toggle behavior:** Clicking the currently-selected (applied) card soft-deletes the Moving Labor charge via `DELETE /api/admin/opportunities/[id]/charges/[chargeId]`. Clicking any other card calls `POST /apply-package`. This makes the picker feel like a radio group with toggle-off capability.

**Colors:** Tier card backgrounds use saturated Tailwind 200/300 levels (amber-200, slate-300, yellow-300, indigo-200) so each card visually reads as its metal. The old pastel 50-level backgrounds (bg-*-50) were near-white and invisible.

**State indicators:**
- Recommended (not applied): Kratos orange ring-4 + floating orange "✨ Recommended" ribbon at top of card
- Applied: green ring-4 + floating green "✓ Selected" ribbon at top of card
- Both ribbons use absolute positioning (`-top-3.5 left-1/2 -translate-x-1/2`) to float above the card border without clipping

**Unselect API route:** Reuses existing `DELETE /api/admin/opportunities/[id]/charges/[chargeId]` — no new route needed.

## 2026-06 — Docs access lives in the right sidebar Information card

**Decision:** The Versions / Activity / Docs buttons live at the bottom of the Information card on the right sidebar of the Estimate tab, not in the page header. Mirrors SmartMoving's pattern where these actions are contextual to the sidebar rather than the main header toolbar.

**Versions and Activity** are placeholder buttons (disabled, `cursor-not-allowed`, "Coming soon" tooltip) until those features are built.

**Docs button** opens the `DocsSidePanel` slide-out from the right. It shows a numeric badge when documents exist.

**Document generation flow:**
1. Agent clicks "Generate Documents" in the panel
2. POST `/api/admin/opportunities/[id]/documents/generate`
3. Server loads all published `document_templates`, renders each one with the opportunity's real data via `lib/documents/render.ts`
4. Each rendered document is upserted into the `documents` table (update if template+opportunity pair exists, insert if not)
5. Panel refreshes and shows the document list

**Merge field engine** (`lib/documents/render.ts`): simple regex replace `{{token}}` → value from a context object built at render time. Falls back to `{{token}}` for unknown fields so partial data doesn't break documents.

## 2026-06 — Document preview: live-render for draft statuses, frozen snapshot for sent+

**Decision:** Documents render live from current opportunity data while in `not_started` or `generated` status. The GET `/api/admin/documents/[id]` route re-renders from the template + current DB data on every request. No intermediate snapshot is stored during preview.

Status `sent` (and `viewed`, `signed`, `completed`) freeze the `rendered_html` snapshot — what the customer received is what stays. The PATCH handler for `status → sent` captures a fresh render into `rendered_html` at the exact moment of marking.

This means agents can change addresses, charges, etc. and the next preview will reflect the updates, but once sent, the document is immutable.

**Dispatch yard address:** constant in `lib/constants/company.ts → KRATOS_DISPATCH_ADDRESS`. Referenced in three places: `quote/page.tsx`, `travel-estimate/route.ts`, and `lib/documents/render.ts` (via `KRATOS_COMPANY.address`). One source, no string literals in application code.

**Stops section:** Four rows in order — Dispatch (departure) → 1 Pick-up → 2 Drop-off → Dispatch (return). Bottom dispatch row has a muted "(Return)" label. Both rows use the same `KRATOS_DISPATCH_ADDRESS` constant.

## 2026-06 — Estimate tab hero row matches SmartMoving

**Decision:** Estimate tab hero row shows: Move Size | Volume & Weight | Estimated Total | Est. Profit. The Package card was removed — package info lives in the tier recommendation section and in the Charges table (Moving Labor row).

**Est. Profit placeholder cost model:** `cost = ($15/hr per mover + $25/hr per truck) × billable_hours`. This is a rough placeholder. Real cost model (fuel, insurance, wages) is a future Settings feature. The `calcProfit()` helper in `quote/page.tsx` is the single source — not duplicated elsewhere.

**Placeholders (visual only, toast on click):** Trip Info section, Add Job tab, Add Rooms, Inventory button, Add End Date, Summary Breakdown, Recalculate. Re-rate Shipment, date picker pill, and Agent dropdown ARE functional.

**Agent dropdown:** The Information card Agent row is now a `<select>` that loads `/api/admin/profiles` on estimate tab open and PATCHes `opportunities.sales_agent_id` on change. Uses existing PATCH allowlist — no schema change needed.

## 2026-06 — Customer portal at /portal/estimate/[token] is force-dynamic

**Decision:** The customer portal at `/portal/estimate/[token]` is rendered with `export const dynamic = 'force-dynamic'` and `export const revalidate = 0`. All opportunity data (charges, addresses, move size, move date, tier) is read live from the database on every request. No caching, no snapshots, no stored totals are trusted.

**Reasoning:** The portal must always reflect the latest state in the CRM. If an agent changes the tier, rate, or any charge, the customer reloading the portal URL must see the new data immediately.

**Implication:** Do not add `unstable_cache`, fetch caching, or any snapshot column reads to the portal route. The `rendered_html` column on the `documents` table is for generated documents only — not for the portal.

## 2026-06 — 1 Bedroom House recommends Silver tier

**Decision:** The `1_bedroom_house` move size maps to the Silver tier in `lib/packages/tiers.ts → recommended_for`. It was previously in Gold's array and has been moved to Silver's.

**Reasoning:** A 1BR house contents fit comfortably in a small truck with 2 movers. 3 movers (Gold) is overkill and overprices the job. Silver (1 truck, 2 movers) is the correct default.

## 2026-06 — Date pill in Estimate tab job summary row is the primary date-editing affordance

**Decision:** The date pill in the Estimate tab's job summary row is a clickable inline editor. Clicking it transforms the pill into a native `<input type="date">` that saves on blur or Enter, and cancels on Escape. It PATCHes `service_date` via the general `PATCH /api/admin/opportunities/[id]` route.

**End Date is not in scope.** The "+ Add End Date" placeholder has been removed entirely. If end dates are added in the future, they will be a new feature, not a re-addition of this placeholder.

## 2026-06 — Workforce board uses @dnd-kit for drag-drop

**Decision:** The Workforce board at `/admin/workforce` uses `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop. Do not use `react-beautiful-dnd` (deprecated) or HTML5 native drag (poor UX on mobile).

**Position model:** Column and person positions are integers stored in `workforce_columns.position` and `workforce_people.position`. Every drag-end sends a full reorder batch to `/api/admin/workforce/columns/reorder` or `/api/admin/workforce/people/reorder`, which renumbers all affected rows in one round trip. No gaps or fractional positions.

**Soft delete — not cascade:** Columns and people are soft-deleted (`is_deleted = true`). When a column is deleted, its people become unassigned (`column_id = null`) rather than cascade-deleted. This prevents accidental data loss.

**Taxonomy tables:** Statuses and tiers are stored in `workforce_statuses` and `workforce_tiers` tables with seeded defaults. The UI always renders from these rows — nothing is hardcoded in components. A settings page for editing/adding statuses and tiers ships in Phase 2.

**Unassigned people (Phase 2):** People with `column_id = null` are not currently visible on the board. Phase 2 will add an "Unassigned" virtual column or a stash panel to surface them.

## 2026-06 — Dispatch is the top-level container for crew-related views

**Decision:** "Dispatch" replaces the standalone "Workforce" sidebar entry. Dispatch is a top-level nav item with two tabs: Workforce (primary, default) and Calendar (deferred placeholder). The sidebar link goes to `/admin/dispatch` which redirects to `/admin/dispatch/workforce`.

**Reasoning:** Workforce management and calendar scheduling are tightly coupled operationally. Grouping them under a single Dispatch umbrella is cleaner than two separate top-level entries. The old `/admin/workforce` page redirects to the new location.

## 2026-06 — People list view is the primary workforce surface

**Decision:** The default view at `/admin/dispatch/workforce` is a grid of person cards (list view). The kanban board at `/admin/dispatch/workforce/board` is a secondary view. List is default because it's better for viewing and editing rich person attributes. The board is for organizing people into freeform columns.

**View toggle:** List | Board toggle in the top-right of the workforce page. Both views read from the same `fetchBoardState()` data source.

## 2026-06 — Profile pictures stored in Supabase Storage bucket `workforce-photos`

**Decision:** Profile pictures are uploaded directly from the browser to Supabase Storage using the anon-key client (no API route proxy). Bucket `workforce-photos` is public (URLs are accessible without auth). 5MB file size limit. JPEG/PNG/WebP/GIF allowed.

**Upload pattern:** `createClient()` from `@/lib/supabase/client` + `supabase.storage.from('workforce-photos').upload(...)`. Plain `<img>` tag for display (not Next.js `<Image>`) — Supabase Storage domain is not in the Next.js image allowlist and configuring it is extra work not worth it here.

## 2026-06 — Locations and roles are configurable taxonomies (stored in DB)

**Decision:** `workforce_locations` and `workforce_roles` are separate tables with `key`, `label`, `color`, `position` columns — same pattern as `workforce_statuses` and `workforce_tiers`. Seeded with Kratos-specific defaults. Settings UI for editing/adding/deleting these taxonomies ships in a later prompt.

**Rationale:** Hardcoding locations in the UI would prevent AJ from adding new cities (e.g. when expanding) without a code change. The DB-driven approach scales to any configurable taxonomy.

## 2026-06 — Profile pictures auto-resize client-side before upload

**Decision:** Profile pictures are resized to 800px max dimension, re-encoded as JPEG at 0.85 quality in the browser before upload. Typical phone photos compress 10MB → ~150KB. Bucket size limit raised to 10MB as a safety margin, not the primary defense.

**Implementation:** `lib/workforce/resize-image.ts → resizeImage()` — canvas-based, runs entirely in the browser. Called in both `AddPersonModal` and `EditPersonDrawer` before `supabase.storage.upload()`.

## 2026-06 — Dispatch Calendar reads directly from opportunities table

**Decision:** The Dispatch Calendar at `/admin/dispatch/calendar` reads from `opportunities` filtered by `status IN ('booked', 'completed')` on `service_date`. No separate `dispatch_jobs` table. The general Calendar at `/admin/calendar` uses the same source — the difference is only which statuses are surfaced and which additional data (office events) is shown.

**Calendar library:** `react-big-calendar` + `date-fns` (v4). Provides Month/Week/Day/Agenda views. The general calendar at `/admin/calendar` is a custom build; the Dispatch Calendar uses react-big-calendar for richer multi-view support.

## 2026-06 — Recurring allowlist bug on people POST route

**Decision:** The `people/route.ts` POST handler had a hardcoded `insert()` that listed only legacy fields (`name, role, status_id, tier_id, column_id, position, notes`). All new columns from the previous session (`role_id, location_id, english_proficiency, profile_picture_url, tenure_started_at`) were silently dropped.

**Fix:** POST now uses the same ALLOWED array + `coercePayload()` pattern as PATCH. Empty strings are coerced to `null` before insert — Postgres rejects `""` for UUID FK columns and date columns.

**Rule:** Any new column on a workforce table that agents can write must be added to BOTH the POST allowlist AND the PATCH allowlist. The column must also be in `NULLABLE_KEYS` if it can be null/empty-string.

## 2026-06 — Dispatch Calendar uses custom MonthGrid, not react-big-calendar

**Decision:** `react-big-calendar` was removed. The Dispatch Calendar uses a custom `MonthGrid` component (~120 lines of Tailwind, zero third-party CSS). react-big-calendar's grid CSS was conflicting with our Tailwind setup, rendering days as a vertical list instead of a 7-column grid. The custom component gives full control over styling and eliminates the class conflict risk.

**Grid logic:** 42 cells (6 weeks × 7 days), padded with previous/next-month days marked `inMonth: false` (greyed out). Month navigation uses URL query params (`?year=&month=`) so the server re-fetches the correct date window on each navigation.

## 2026-06 — Day detail view is a skeleton placeholder for Phase D

**Decision:** `/admin/dispatch/calendar/[date]` shows booked/completed jobs for that date with stats (count, revenue) and a job list. A "Resource assignment coming soon" placeholder sits at the bottom where the drag-to-assign Resource panel will eventually land.

**Phase D prerequisites:** Trucks/vehicles data model + a crew-assignment table linking `workforce_people` and trucks to specific opportunities. Until those tables exist, the full Resource Calendar (trucks as rows, time grid, drag-to-assign) cannot be built.

## 2026-06 — Distance Matrix called server-side; new env var GOOGLE_MAPS_SERVER_API_KEY

**Decision:** Google Maps Distance Matrix calls run server-side only via `/api/admin/maps/distance` and the sync helpers in `lib/charges/travel.ts`. The existing `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is restricted to `vercel.app` referrers and fails for server-to-server calls. The separate env var `GOOGLE_MAPS_SERVER_API_KEY` (or `GOOGLE_MAPS_SERVER_KEY`) carries the unrestricted key.

**Key lookup order:** `GOOGLE_MAPS_SERVER_API_KEY` → `GOOGLE_MAPS_SERVER_KEY` → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (fallback, may fail server-side).

## 2026-06 — Trip & Travel auto-computed from return leg; threshold 30 min; floor to 0.5h

**Decision:** The Trip & Travel charge is automatically created/updated/deleted by `lib/charges/syncTravelCharge.ts` based on the destination → dispatch return-leg drive time.

- Threshold: 30 minutes. Below threshold → no charge (door-to-door labor absorbs it).
- Rounding: floor to nearest 0.5h (rounded DOWN, not up).
- Rate: same hourly rate as the applied Moving Labor package.
- Trigger: on `apply-package` and on destination address change (`trip-info` PATCH with `prefix: 'dest'`).
- Failure mode: if Distance Matrix call fails, existing charge is preserved and a warning is returned. Charge is never deleted on API failure.
- Config shape: `{ source: 'auto_distance_matrix', return_drive_minutes, billable_hours, hourly_rate, computed_at }`

## 2026-06 — Travel hours removed from Moving Labor edit drawer

**Decision:** The "Travel" section (travel_hours input, Google Maps badge) has been removed from the Moving Labor edit drawer (`ChargeSidePanel.tsx`). Travel is now its own `trip_and_travel` charge line — it is no longer a sub-field of Moving Labor. New Moving Labor saves always write `travel_hours: 0` to the config.

**Auto-recompute always wins:** No manual override flag on the Trip & Travel charge yet. Phase 2 will add `is_overridden` support so dispatchers can lock a custom value.

## 2026-06 — Dispatch day-detail uses a three-column layout matching SmartMoving

**Decision:** `/admin/dispatch/calendar/[date]` uses a three-column layout: Resources panel (240px fixed left), Schedule grid (flexible middle), Jobs panel (300px fixed right). Implemented in `components/admin/dispatch/DispatchDayDetail.tsx`.

- **Resources (left):** Trucks/Crew tabs (visually present, disabled). "No trucks yet" empty state with disabled "+ Add truck (coming soon)" button. Wired in Phase B1.
- **Schedule (middle):** Hours axis 8a–6p across the top. Vertical gridlines implied via CSS background-image pattern. Empty state with explanatory copy. Wired in Phase B2.
- **Jobs (right):** Real data from existing `fetchDispatchCalendarEvents`. Job cards show customer name, total, move size, route, and a `⏱ TBD` time placeholder (until `move_time_start` lands in Phase B2).

**Reasoning:** Matches SmartMoving's Scheduling tab structure — the visual scaffold is in place before the data layer (trucks + assignments) exists, so Phase B1/B2/B3 can drop into a working layout without a re-layout session.

**Column layout:** `grid grid-cols-1 md:grid-cols-[240px_1fr_300px]` — stacks vertically on mobile.

## 2026-06 — Dispatch B1: trucks split into 3 categories; provider field rental-only

**Decision:** `dispatch_trucks.category` is one of `owned`, `rental`, `contractor`. The `provider` field (Penske, Ryder, U-Haul, Home Depot, Other) is only populated when `category = 'rental'` — it is set to null on save for owned and contractor trucks.

**Size enum:** `cargo_van`, `10ft`, `15ft`, `16ft`, `20ft`, `26ft`. Fixed list, not free-text. Validated at the API layer.

**Seeded default:** One owned 16ft truck ("Kratos 16ft Box") is inserted by the migration SQL. AJ adds the rest via the "+ Add Truck" inline form in the Resources panel.

## 2026-06 — Dispatch B1: Crew tab pulls live from workforce_people

**Decision:** The Crew tab in the dispatch Resources panel reads directly from `workforce_people` with role/status/tier joins. No separate "dispatch crew" concept. Adding a person in Workforce automatically makes them visible in the Crew tab. The Crew tab is read-only in B1 — crew assignment within a drag is Phase B2.

## 2026-06 — Dispatch B1: drag-drop creates dispatch_job_assignments; no time-of-day in B1

**Decision:** Dragging a job card from the Jobs panel onto a truck row in the Schedule grid creates a `dispatch_job_assignments` row. Clicking X on an assigned job card soft-deletes the assignment (is_deleted=true).

**Assignment constraints:** One row per drag. Multiple assignments per truck on the same date are allowed (truck can do multiple moves). Multiple trucks per opportunity are allowed at the schema level (multi-truck moves) but require multiple drags via the UI.

**No time-of-day positioning in B1.** All assignments default to `start_time = '08:00'` and `duration_hours = 3`. Jobs appear full-width in their truck row. Time-of-day axis rendering and per-assignment time editing land in Phase B2 alongside `move_time_start` on opportunities.

**Optimistic updates:** Drag-drop uses an optimistic temp assignment (client-side temp ID) → POST to API → replace temp with real row on success → rollback on failure. This prevents the UI feeling laggy on slow connections.

**DragOverlay:** Uses `@dnd-kit/core`'s `DragOverlay` so a floating clone follows the cursor during drag, while the original card dims (opacity-30) in place. This is better UX than moving the original element.

## 2026-06 — Dispatch B1.5: Schedule grid uses CREW rows, not truck rows

**Decision:** The Schedule grid in `/admin/dispatch/calendar/[date]` shows one row per **crew**, not one row per truck. Each crew row has 4 configurable slots: Truck, Driver, Dispatcher, Helpers. A job is dragged onto a crew row (not a truck). The `dispatch_job_assignments` table now references `crew_id` (FK to `dispatch_crews`) instead of `truck_id`.

**Reasoning:** B1 modeled rows as trucks, which is architecturally wrong. SmartMoving's Scheduling tab shows crew rows — a crew is the operational unit that does a job. A truck is just one of the crew's resources. AJ confirmed this after building B1. The correct mental model: "Crew 1 has Penske 26ft + John (driver) + Mike + Tom. Crew 1 is doing the Johnson move."

**New tables:**
- `dispatch_crews` — one row per crew per day; FK to truck, driver, dispatcher; `position` int
- `dispatch_crew_helpers` — junction table (crew_id, person_id, UNIQUE); CASCADE delete when crew deleted
- `dispatch_job_assignments` — rebuilt: `crew_id` replaces `truck_id`; added `position` int

**Slot labels when empty:**
- Truck slot: "No Trucks"
- Driver slot: "No Kratos Driver"
- Dispatcher slot: "No Dispatcher"
- Helpers slot: "No Kratos Crew"

**Slot popovers:** Fixed-position floating panels (`position: fixed` calculated from `getBoundingClientRect()`). Close on outside mousedown or scroll. Truck popover groups trucks by category (Owned/Rentals/Contractor). Person popovers show workforce_people with avatars.

**Optimistic updates:** All crew mutations (add, delete, update slot, add/remove helper, assign/unassign job) use optimistic state + API commit + rollback-via-refresh on failure. No full page refresh needed.

**Driver/Dispatcher can't also be a Helper:** Each person can only occupy one slot per crew row. The HelpersSlot and PersonSlot popover filter out already-assigned people.

**Anti-patterns confirmed NOT in scope for B1.5:** time-of-day on assignments, multi-truck per crew, seeded crew rows, filtering workforce dropdowns by role.

## (Append new decisions below as they happen)
