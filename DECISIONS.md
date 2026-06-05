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

## (Append new decisions below as they happen)
