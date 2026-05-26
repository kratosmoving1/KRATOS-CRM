# READ THIS FIRST OR YOU WILL BREAK THE PROJECT

Before writing any code that references the database, you MUST:

1. Open `SCHEMA.md` at the repo root.
2. Confirm every column name you're about to reference exists EXACTLY as written there. Watch especially for shortened names — see the "Common Mistakes" section at the bottom of SCHEMA.md.
3. If a column doesn't exist, STOP and tell AJ. Do not guess names. Do not infer from context. Do not invent. Past sessions where you violated this rule have cost AJ 4+ wasted iterations.

Before changing architecture, tooling, or approach:

1. Read `DECISIONS.md`.
2. If you're about to do something already decided against, STOP and ask AJ.

Before starting a new feature:

1. Read `ROADMAP.md`.
2. Confirm the feature is the next item up. If it isn't, ask before working ahead.

When ending a session:

1. Update `ROADMAP.md` to reflect what's done.
2. If you made an architectural decision, append it to `DECISIONS.md`.
3. If you changed the database schema, update `SCHEMA.md`.
4. **Verify your work in production (Vercel) in an incognito browser window before claiming done.** AJ has been burned by sessions that claimed success based on `npm run build` passing. Build success ≠ feature working.

---

## Companion files at the repo root

- `SCHEMA.md` — flat reference of every database table and column. Source of truth for schema state. Read before touching any DB column.
- `DECISIONS.md` — running log of architectural decisions. What was decided and why. Read before changing patterns or libraries.
- `ROADMAP.md` — what's done, what's in progress, what's coming. Confirms the order of work.

All three should be kept current. If you make changes that affect them, update them in the same commit.

---

# Kratos CRM — Project Context

## What this is

Kratos CRM is a custom-built CRM for Kratos Moving Inc., a moving and logistics company based in Ontario, Canada. AJ is the founder/CEO and is building this as the eventual replacement for SmartMoving (smartmoving.com), which the company currently uses operationally.

The product is internally called "Kratos CRM" (the GitHub repo is `KRATOS-CRM`). Long-term it's meant to become the central operating system for the broader Kratos Group of Companies (Cleaning, Painting, Security, JMF Logistics) — but that's far down the roadmap. Right now, focus is Kratos Moving only.

## Who AJ is

- Founder/CEO of Kratos Moving Inc.
- Not a professional developer. Comfortable with high-level direction, basic Git, copying SQL into Supabase, and reading Claude Code output. Cannot debug TypeScript on his own.
- Uses Claude Code via VS Code on macOS.
- Asks for help via long voice notes, mobile screenshots, and high-context messages. Be direct, push back on bad ideas, ship working specs rather than generic advice.
- Has been burned by "looks good in dev, breaks in production" cycles. Always verify on the Vercel production URL before claiming done.

## Tech stack

- **Frontend:** Next.js 14+ (App Router) + TypeScript (strict mode) + Tailwind CSS
- **Database:** Supabase Postgres + Auth + Storage (hosted)
- **Hosting:** Vercel (production at `kratos-crm.vercel.app`)
- **UI primitives:** shadcn/ui
- **Charts:** recharts
- **Icons:** lucide-react (no emoji)
- **Auth:** `@supabase/ssr`
- **Maps:** `@googlemaps/js-api-loader` v2 with a custom-built dropdown (NOT `use-places-autocomplete` or `@reach/combobox` — both removed, see DECISIONS.md)
- **Telephony:** RingCentral (OAuth per user, call + SMS logging)
- **Background jobs (when added):** Inngest or Trigger.dev
- **AI (when added):** Anthropic API (Claude)
- **Vector search (when added):** pgvector extension on Supabase
- **Payments (when added):** Stripe
- **E-signature (when added):** Zoho Sign or BoldSign

## What is NOT in scope

- Salesforce — abandoned in favor of Next.js + Supabase
- Microservices — keep it a monolith
- GraphQL — use REST
- Building a separate vector DB — pgvector is fine
- Multi-company UI separation — schema has `company_id` placeholder but DO NOT build separation logic yet
- Mobile native apps — PWA only when crew/customer apps are built later

## Brand

- Primary color: `#ffad33` (Kratos orange), defined as Tailwind color `kratos`
- Product display name: "Kratos CRM"
- Tone: confident, operational, professional, slightly warmer than enterprise software
- Logo: `public/logo.png` (warrior-style mascot — gray and orange)
- No emoji in UI, no cutesy language

## Repository structure (current)
KRATOS-CRM/
├── app/
│   ├── admin/                # Internal CRM (sales agents, admins)
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Dashboard
│   │   ├── login/page.tsx
│   │   ├── opportunities/    # List + [id] detail + [id]/quote detail
│   │   ├── customers/        # List + [id] detail
│   │   ├── estimates/        # stub
│   │   ├── calls/            # stub
│   │   ├── follow-ups/       # stub
│   │   ├── invoices/         # stub
│   │   ├── reports/          # stub
│   │   └── settings/         # stub + templates page
│   ├── portal/estimate/[token]/  # Customer-facing estimate portal
│   └── api/admin/            # All internal API routes
├── components/
│   ├── admin/                # Admin UI components + modals
│   └── ui/                   # shadcn primitives + AddressAutocomplete
├── lib/
│   ├── supabase/             # server.ts, client.ts, middleware.ts
│   ├── auth/permissions.ts   # hasPermission(), isActiveUser(), normalizeRole()
│   ├── audit/logAuditEvent.ts# writes to audit_logs table
│   ├── estimates/portal.ts   # portal token generation/lookup
│   ├── queries/              # dashboard.ts etc.
│   ├── opportunityColumns.ts # ALLOWED_OPPORTUNITY_COLUMNS allowlist for PATCH
│   ├── format.ts             # currency, date formatters
│   └── utils.ts              # cn() helper
├── types/database.ts         # generated Supabase types — source of truth
├── supabase/                 # migrations folder (DO NOT USE — see Database changes)
├── public/                   # logo.png, static assets
├── middleware.ts             # auth redirect for /admin/*
├── CLAUDE.md                 # this file
├── SCHEMA.md                 # database column reference
├── DECISIONS.md              # architectural decisions log
└── ROADMAP.md                # what's done, what's next

## Database state

The hosted Supabase database is the **source of truth**. AJ runs all schema changes manually via the Supabase SQL Editor — not via the Supabase CLI, not via `db push`, not via local migrations.

Current tables (verify exact columns in SCHEMA.md):
- `profiles` (mirrors auth.users with role + name)
- `lead_sources`
- `customers`
- `opportunities`
- `audit_log` (lightweight timeline feed)
- `audit_logs` (detailed structured audit trail)
- `tasks`
- `follow_ups`
- `communications`
- `payments`
- `estimate_portal_links`
- `communication_templates`

The `get_dashboard_data()` RPC powers the admin dashboard. All RLS is enabled with permissive policies (`authenticated users can do anything`) for now — proper role-based RLS comes in a later session.

### Status model

Opportunities use a 5-status model:
- `opportunity` — inquiry stage (any not-yet-booked lead)
- `booked` — scheduled in, job committed
- `completed` — job done, accounting not finalized
- `closed` — job done AND accounting closed
- `cancelled` — customer cancelled

Allowed transitions:
- `opportunity` → `booked` or `cancelled`
- `booked` → `completed` or `cancelled`
- `completed` → `closed` or `cancelled`
- `closed` → terminal
- `cancelled` → can be reopened to `opportunity`

## Database changes — IMPORTANT

**Do NOT generate Supabase migration files in `supabase/migrations/`.** Past sessions have had repeated drift between local migration files and the actual hosted database state. Every schema change is run directly in the Supabase SQL Editor by AJ.

When you need a schema change:
1. Write the SQL as a code block in your response
2. Use `if not exists` / `if exists` guards everywhere so it's safe to re-run
3. For functions, use named dollar quotes like `$func$ ... $func$` instead of `$$ ... $$` (Supabase's editor auto-injects RLS statements that break unnamed dollar quotes)
4. Tell AJ to paste it into Supabase SQL Editor → click Run
5. Wait for him to confirm "success" before continuing
6. After confirming, update `SCHEMA.md` and regenerate `types/database.ts`

**Never run destructive SQL (DROP TABLE, TRUNCATE, DELETE without WHERE) without explicit AJ confirmation first.**

After SQL changes, regenerate types with `supabase gen types typescript --project-id <project-id>` and commit `types/database.ts`.

## Environments

- **Production:** `kratos-crm.vercel.app` — connected to the production Supabase project
- **Development:** `localhost:3000` via `npm run dev` — uses `.env.local` pointing at the same Supabase project (no separate staging DB yet)

Env vars (in `.env.local` and Vercel):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `RINGCENTRAL_CLIENT_ID`
- `RINGCENTRAL_CLIENT_SECRET`
- `RINGCENTRAL_SERVER_URL`

When updating env vars on Vercel, always set all three environments: `production`, `preview`, `development`. Then redeploy with `npx vercel --prod`.

## Working with AJ — operating principles

1. **Diagnose before fixing.** When something's broken, find the root cause first. Don't add patches on top of bad code. One sentence of "this is what's wrong" before any code changes.
2. **Ask for blockers up front, all at once.** If you need an API key, a file, a decision, a credential — ask for ALL of them in one message at the start, not one at a time.
3. **Don't generate migration files.** Database changes go through Supabase SQL Editor (see above).
4. **Verify on production.** AJ tests on the Vercel URL. "Works on localhost" doesn't count.
5. **No silent fallbacks for critical features.** If Google Maps fails to load, show an error — don't silently degrade to plain text input, because then AJ thinks the feature isn't built.
6. **Use shadcn/ui patterns.** Don't roll custom dropdowns / dialogs / inputs when shadcn equivalents exist.
7. **Use Postgres aggregates server-side.** Don't pull all opportunities into Node to count them. Use `count(*) filter (where ...)`, `sum(...)`, `date_trunc(...)`.
8. **Format numbers/dates on the client.** Server returns raw numbers and ISO dates. Client uses `Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })`.
9. **All API routes return typed responses.** No `any` types except where genuinely necessary, commented why.
10. **Soft delete only.** All business tables have `is_deleted boolean default false`. Never `DELETE FROM` business tables.
11. **Audit log everything.** Status changes, creates, edits, deletes — write to both `audit_log` (timeline) and `audit_logs` (structured) via `logAuditEvent()`.
12. **Mobile-responsive by default.** AJ tests on iPhone often. Modals should be full-screen on narrow viewports; tables should scroll horizontally.
13. **Column name discipline.** Before any Supabase query, cross-check every column name against `SCHEMA.md`. The wrong column name silently returns null or throws a DB error with no TypeScript warning.

## Hand-off etiquette

At the end of every session, AJ wants:
1. ✅ / ❌ checklist of tasks attempted
2. Any SQL he needs to paste into Supabase (with exact text)
3. Which files changed
4. What's still stubbed / coming next
5. The Vercel preview URL to test on

## SmartMoving reference

When in doubt about how a feature should work or look, the SmartMoving product (`app.smartmoving.com`) is the reference. AJ has used it for years and will share screenshots when patterns matter. The Kratos CRM is a Kratos-branded, owned-data version of similar workflows — not a clone, but inspired.

## Last updated

This file should be updated when:
- A major architectural decision is made
- A new tool / library is adopted
- A roadmap milestone completes
- A core working pattern changes

Edit it directly when those happen. Don't let it go stale.
