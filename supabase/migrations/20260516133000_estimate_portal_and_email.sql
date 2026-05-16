-- Estimate sending and customer portal foundation.

alter table public.opportunities
  add column if not exists deposit_amount numeric(10,2),
  add column if not exists estimate_sent_at timestamptz,
  add column if not exists estimate_sent_by uuid references public.profiles(id);

create table if not exists public.estimate_portal_links (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  quote_id uuid,
  token text unique not null,
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz
);

create index if not exists idx_estimate_portal_links_opportunity
  on public.estimate_portal_links(opportunity_id);

create index if not exists idx_estimate_portal_links_token
  on public.estimate_portal_links(token);

alter table public.estimate_portal_links enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'estimate_portal_links'
      and policyname = 'auth users full access'
  ) then
    create policy "auth users full access"
    on public.estimate_portal_links
    for all
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;

insert into public.communication_templates (name, channel, trigger, subject, body, is_active)
select 'Estimate Ready Email', 'email', 'estimate_ready', 'Your Kratos Moving estimate is ready',
'Hi {{customer_first_name}},

Your Kratos Moving estimate is ready for review.

You can view your estimate here:
{{estimate_link}}

Deposit required to secure your move:
{{deposit_amount}}

If you have any questions or would like to make changes, please reply to this email or call us at {{company_phone}}.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.', true
where not exists (
  select 1 from public.communication_templates
  where channel = 'email'
    and trigger = 'estimate_ready'
    and name = 'Estimate Ready Email'
);

update public.communication_templates
set
  subject = 'Your Kratos Moving estimate is ready',
  body = 'Hi {{customer_first_name}},

Your Kratos Moving estimate is ready for review.

You can view your estimate here:
{{estimate_link}}

Deposit required to secure your move:
{{deposit_amount}}

If you have any questions or would like to make changes, please reply to this email or call us at {{company_phone}}.

Thank you,
{{agent_first_name}}
Kratos Moving Inc.',
  is_active = true,
  updated_at = now()
where channel = 'email'
  and trigger = 'estimate_ready'
  and name = 'Estimate Ready Email';
