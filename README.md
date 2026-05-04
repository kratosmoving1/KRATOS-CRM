# Kratos CRM

Internal CRM for **Kratos Moving Inc.** — built with Next.js 14, Supabase, and Tailwind CSS.

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- Git

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/kratosmoving1/KRATOS-CRM.git
cd KRATOS-CRM
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in your Supabase credentials:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → service_role key ⚠️ keep secret |

### 4. Apply database migrations

Go to your Supabase project → **SQL Editor** → click **New Query**, paste the contents of `supabase/migrations/0001_initial_schema.sql`, and click **Run**.

This creates all tables, RLS policies, triggers, and the `get_dashboard_data()` function.

### 5. Seed the database

```bash
npm run seed
```

This creates:
- 8 lead sources (LSA, Google Ads, Facebook Ads, etc.)
- 5 sales agents (auth users + profiles)
- 80 customers
- ~250 opportunities spread across the trailing 12 months

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/admin/login`.

---

## Creating your admin account

1. Go to Supabase dashboard → **Authentication** → **Users** → **Add user**
2. Enter your email and a strong password, and confirm the email
3. Go to **Table Editor** → `profiles` → find your row → set `role` to `admin`

---

## Seeded login credentials

All seeded agents use the password: **`KratosTest!2026`**

| Name | Email |
|---|---|
| Alex S. | alex@kratosmoving.ca |
| Maria R. | maria@kratosmoving.ca |
| Daniel K. | daniel@kratosmoving.ca |
| Priya N. | priya@kratosmoving.ca |
| Jordan T. | jordan@kratosmoving.ca |

> **Change these passwords** before sharing the project with anyone.

---

## Push to GitHub

The remote is already configured. Once you've confirmed the GitHub repo is empty:

```bash
git push -u origin main
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Database & Auth | Supabase (Postgres + Auth) |
| Charts | Recharts |
| Icons | Lucide React |
| UI primitives | Built-in (shadcn-inspired) |

---

## Project structure

```
KRATOS-CRM/
├── app/
│   ├── admin/              # Protected admin shell
│   │   ├── layout.tsx      # Sidebar + header shell
│   │   ├── page.tsx        # Dashboard
│   │   ├── login/          # Auth page
│   │   └── ...             # Stub pages
│   ├── api/admin/dashboard/ # Dashboard data API
│   ├── layout.tsx
│   └── page.tsx            # Redirects to /admin
├── components/admin/       # Dashboard components
├── lib/
│   ├── supabase/           # Client / server / middleware helpers
│   ├── queries/            # Dashboard query
│   └── format.ts           # Currency formatter
├── types/database.ts       # Supabase table types
├── supabase/
│   ├── migrations/         # SQL migrations (apply via SQL editor)
│   └── seed/seed.ts        # Seed script
└── middleware.ts            # Auth guard
```
