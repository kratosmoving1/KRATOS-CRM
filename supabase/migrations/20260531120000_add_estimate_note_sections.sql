alter table public.opportunities
  add column if not exists customer_notes text,
  add column if not exists crew_notes text,
  add column if not exists dispatcher_notes text;
