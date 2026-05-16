-- RingCentral click-to-call activity metadata

alter table public.communications
  add column if not exists phone_number text,
  add column if not exists status text;

create index if not exists idx_communications_phone_number
  on public.communications(phone_number)
  where phone_number is not null;

create index if not exists idx_communications_status
  on public.communications(status)
  where status is not null;
