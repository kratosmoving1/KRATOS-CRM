-- Payments foundation for manual records and Stripe Checkout tracking.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id),
  quote_id uuid,
  customer_id uuid references public.customers(id),
  method text not null,
  status text not null default 'recorded',
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'cad',
  provider text not null default 'manual',
  reference_number text,
  notes text,
  payment_date date not null default current_date,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create index if not exists idx_payments_opportunity
  on public.payments(opportunity_id)
  where is_deleted = false;

create index if not exists idx_payments_customer
  on public.payments(customer_id)
  where is_deleted = false;

create index if not exists idx_payments_created_at
  on public.payments(created_at desc);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function set_updated_at();

alter table public.payments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'auth users full access'
  ) then
    create policy "auth users full access"
    on public.payments
    for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;
