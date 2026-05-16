-- Customer-facing estimate signature records.

create table if not exists public.estimate_signatures (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  quote_id uuid,
  signer_name text not null,
  signer_email text,
  signature_data text not null,
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists idx_estimate_signatures_opportunity
  on public.estimate_signatures(opportunity_id);

alter table public.estimate_signatures enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'estimate_signatures'
      and policyname = 'auth users full access'
  ) then
    create policy "auth users full access"
    on public.estimate_signatures
    for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;
