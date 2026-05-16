-- Provider metadata for RingCentral SMS/call activity records.

alter table public.communications
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists error_message text;

create index if not exists idx_communications_provider_message_id
  on public.communications(provider, provider_message_id)
  where provider_message_id is not null;
