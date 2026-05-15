# Kratos CRM Payments TODO

Payments are currently in foundation mode. The quote UI can open an Add Payment drawer, and Stripe Checkout has a server-side skeleton route, but payment records are not persisted because there is no `payments` table yet.

## Current Status

- `POST /api/payments/stripe/checkout` creates a Stripe Checkout Session when `STRIPE_SECRET_KEY` is configured.
- `POST /api/payments/stripe/webhook` verifies Stripe signatures and logs verified webhook events.
- Record-only methods are UI placeholders and do not save payment records yet.
- Payment totals in the quote side panel use safe placeholders until persisted payment data exists.

## Required Environment Variables

- `STRIPE_SECRET_KEY`: server-only Stripe secret key.
- `STRIPE_WEBHOOK_SECRET`: server-only webhook signing secret.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: optional future client-side Stripe usage only.

## Recommended `payments` Schema

```sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id),
  quote_id uuid null,
  customer_id uuid references public.customers(id),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  payment_method text not null,
  status text not null,
  amount_cents integer not null,
  currency text not null default 'cad',
  paid_at timestamptz null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;
```

## Audit Events Planned / Started

- `payment_checkout_created`: implemented in Stripe Checkout route.
- `stripe_webhook_received`: implemented in Stripe webhook route.
- `payment_succeeded`: implemented as audit-only until `payments` exists.
- `payment_failed`: implemented as audit-only until `payments` exists.
- `payment_record_created`: pending record-payment route after `payments` exists.

## Next Build Step

After the `payments` table exists, add:

- Server route for record-only payments.
- Webhook persistence for succeeded/failed Stripe payments.
- Quote side panel totals from real payment rows.
- Admin-only refunds/voids later, with audit logging.
