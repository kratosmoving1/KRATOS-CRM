-- Lightweight KGC division field for quote records.

alter table public.opportunities
  add column if not exists company_division text;

update public.opportunities
set company_division = 'kratos_moving'
where company_division is null;

create index if not exists idx_opportunities_company_division
  on public.opportunities(company_division)
  where is_deleted = false;
