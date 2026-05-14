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
- **Maps:** `use-places-autocomplete` + `@types/google.maps` with Google Maps Places API (custom dropdown — NOT @reach/combobox which is React 16/17 only)
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
│   │   ├── opportunities/    # List + [id] detail
│   │   ├── customers/        # List + [id] detail
│   │   ├── estimates/        # stub
│   │   ├── calls/            # stub
│   │   ├── follow-ups/       # stub
│   │   ├── invoices/         # stub
│   │   ├── reports/          # stub
│   │   └── settings/         # stub
│   └── api/admin/            # All internal API routes
├── components/
│   ├── admin/                # Admin UI components
│   └── ui/                   # shadcn primitives
├── lib/
│   ├── supabase/             # server.ts, client.ts, middleware.ts
│   ├── queries/              # dashboard.ts etc.
│   ├── format.ts             # currency, date formatters
│   └── utils.ts              # cn() helper
├── types/database.ts         # generated Supabase types
├── supabase/                 # migrations folder, but see "Database changes" below
├── public/                   # logo.png, static assets
├── middleware.ts             # auth redirect for /admin/*
└── CLAUDE.md                 # this file

## Database state

The hosted Supabase database is the **source of truth**. AJ runs all schema changes manually via the Supabase SQL Editor — not via the Supabase CLI, not via `db push`, not via local migrations.

Existing tables (as of session 3):
- `profiles` (mirrors auth.users with role + name)
- `lead_sources`
- `customers`
- `opportunities`
- `audit_log`
- `tasks`
- `follow_ups`
- `communications`

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
11. **Audit log everything.** Status changes, creates, edits, deletes — write to `audit_log`.
12. **Mobile-responsive by default.** AJ tests on iPhone often. Modals should be full-screen on narrow viewports; tables should scroll horizontally.

## Hand-off etiquette

At the end of every session, AJ wants:
1. ✅ / ❌ checklist of tasks attempted
2. Any SQL he needs to paste into Supabase (with exact text)
3. Which files changed
4. What's still stubbed / coming next
5. The Vercel preview URL to test on

## Roadmap (where we are and what's next)

### Done
- Session 1: Foundation — Next.js + Supabase scaffold, schema, auth, admin shell, dashboard with seeded data
- Session 2: `+` button menu, 3-step New Opportunity modal, opportunities list, opportunity detail, customers list, customers detail, logo, status model
- Session 3: 5-status migration, mandatory field cleanup, Google Maps autocomplete (partially — autocomplete bug being fixed), customer detail redesign, opportunity detail with Sales + Estimate tabs, communications table

### In progress
- Bug fixes: Google Maps autocomplete not firing on production; logo broken image in some views

### Coming
- **Session 4:** Tariff configuration (AJ inputs his pricing rules) → automatic estimate pricing engine → "Send Estimate" wired to a customer-facing estimate portal at `/estimate/[token]` with Stripe deposit collection + e-signature
- **Session 5:** Native invoicing + per-opportunity Accounting tab + Profitability tab with real cost tracking (labor, truck, materials, fuel)
- **Session 6:** Calls module (manual logging functional, RingCentral integration), follow-ups dashboard, real email sending via Resend
- **Session 7+:** Dispatch board, crew app (mobile PWA), Telegram bot integration, AI summarization for calls + leads, dashboards/reports deepening

### Not soon (deliberately deferred)
- Multi-company / multi-tenant UI
- Franchise/owner-operator support
- Real-time subscriptions
- Full SmartMoving migration cutover (parallel running phase)

## SmartMoving reference

When in doubt about how a feature should work or look, the SmartMoving product (`app.smartmoving.com`) is the reference. AJ has used it for years and will share screenshots when patterns matter. The Kratos CRM is a Kratos-branded, owned-data version of similar workflows — not a clone, but inspired.

## Last updated

This file should be updated when:
- A major architectural decision is made
- A new tool / library is adopted
- A roadmap milestone completes
- A core working pattern changes

Edit it directly when those happen. Don't let it go stale.
