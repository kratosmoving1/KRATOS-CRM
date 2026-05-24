-- Repair the Customer -> Quotes relationship without deleting customer or quote data.
-- The physical quote table is still public.opportunities.

create or replace function public.kratos_normalize_phone(value text)
returns text
language sql
immutable
as $$
  select case
    when value is null or btrim(value) = '' then null
    when length(regexp_replace(value, '\D', '', 'g')) = 11
      and left(regexp_replace(value, '\D', '', 'g'), 1) = '1'
      then right(regexp_replace(value, '\D', '', 'g'), 10)
    else nullif(regexp_replace(value, '\D', '', 'g'), '')
  end
$$;

create or replace function public.kratos_normalize_email(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(value)), '')
$$;

do $$
declare
  duplicate_phone_groups int := 0;
  duplicate_email_groups int := 0;
  reassigned_duplicate_quotes int := 0;
  repaired_quotes int := 0;
  remaining_orphans int := 0;
  quote_record record;
  canonical_customer_id uuid;
  quote_json jsonb;
  candidate_name text;
  candidate_phone text;
  candidate_email text;
begin
  select count(*) into duplicate_phone_groups
  from (
    select public.kratos_normalize_phone(phone)
    from public.customers
    where coalesce(is_deleted, false) = false
      and public.kratos_normalize_phone(phone) is not null
    group by 1
    having count(*) > 1
  ) duplicates;

  select count(*) into duplicate_email_groups
  from (
    select public.kratos_normalize_email(email)
    from public.customers
    where coalesce(is_deleted, false) = false
      and public.kratos_normalize_email(email) is not null
    group by 1
    having count(*) > 1
  ) duplicates;

  with phone_canonicals as (
    select distinct on (public.kratos_normalize_phone(phone))
      public.kratos_normalize_phone(phone) as match_key,
      id as canonical_id
    from public.customers
    where coalesce(is_deleted, false) = false
      and public.kratos_normalize_phone(phone) is not null
    order by public.kratos_normalize_phone(phone), created_at asc, id asc
  ),
  phone_duplicates as (
    select c.id as duplicate_id, pc.canonical_id
    from public.customers c
    join phone_canonicals pc
      on pc.match_key = public.kratos_normalize_phone(c.phone)
    where c.id <> pc.canonical_id
      and coalesce(c.is_deleted, false) = false
  ),
  updated as (
    update public.opportunities o
    set customer_id = d.canonical_id
    from phone_duplicates d
    where o.customer_id = d.duplicate_id
    returning o.id
  )
  select count(*) into reassigned_duplicate_quotes from updated;

  with email_canonicals as (
    select distinct on (public.kratos_normalize_email(email))
      public.kratos_normalize_email(email) as match_key,
      id as canonical_id
    from public.customers
    where coalesce(is_deleted, false) = false
      and public.kratos_normalize_email(email) is not null
    order by public.kratos_normalize_email(email), created_at asc, id asc
  ),
  email_duplicates as (
    select c.id as duplicate_id, ec.canonical_id
    from public.customers c
    join email_canonicals ec
      on ec.match_key = public.kratos_normalize_email(c.email)
    where c.id <> ec.canonical_id
      and coalesce(c.is_deleted, false) = false
  ),
  updated as (
    update public.opportunities o
    set customer_id = d.canonical_id
    from email_duplicates d
    where o.customer_id = d.duplicate_id
    returning o.id
  )
  select reassigned_duplicate_quotes + count(*) into reassigned_duplicate_quotes from updated;

  for quote_record in
    select o.*, c.full_name as existing_customer_name, c.email as existing_customer_email, c.phone as existing_customer_phone
    from public.opportunities o
    left join public.customers active_customer
      on active_customer.id = o.customer_id
      and coalesce(active_customer.is_deleted, false) = false
    left join public.customers c
      on c.id = o.customer_id
    where active_customer.id is null
    order by o.created_at asc, o.id asc
  loop
    quote_json := to_jsonb(quote_record);
    candidate_name := coalesce(
      nullif(quote_json->>'customer_name', ''),
      nullif(quote_record.existing_customer_name, ''),
      'Unknown Customer ' || coalesce(quote_record.opportunity_number, quote_record.id::text)
    );
    candidate_phone := coalesce(
      nullif(quote_json->>'customer_phone', ''),
      nullif(quote_json->>'phone', ''),
      nullif(quote_record.existing_customer_phone, '')
    );
    candidate_email := coalesce(
      nullif(quote_json->>'customer_email', ''),
      nullif(quote_json->>'email', ''),
      nullif(quote_record.existing_customer_email, '')
    );

    canonical_customer_id := null;

    if public.kratos_normalize_phone(candidate_phone) is not null then
      select id into canonical_customer_id
      from public.customers
      where coalesce(is_deleted, false) = false
        and public.kratos_normalize_phone(phone) = public.kratos_normalize_phone(candidate_phone)
      order by created_at asc, id asc
      limit 1;
    end if;

    if canonical_customer_id is null and public.kratos_normalize_email(candidate_email) is not null then
      select id into canonical_customer_id
      from public.customers
      where coalesce(is_deleted, false) = false
        and public.kratos_normalize_email(email) = public.kratos_normalize_email(candidate_email)
      order by created_at asc, id asc
      limit 1;
    end if;

    if canonical_customer_id is null
      and public.kratos_normalize_phone(candidate_phone) is null
      and public.kratos_normalize_email(candidate_email) is null then
      select id into canonical_customer_id
      from public.customers
      where coalesce(is_deleted, false) = false
        and lower(btrim(full_name)) = lower(btrim(candidate_name))
      order by created_at asc, id asc
      limit 1;
    end if;

    if canonical_customer_id is null then
      insert into public.customers (full_name, phone, email)
      values (
        candidate_name,
        case when public.kratos_normalize_phone(candidate_phone) is null then null else candidate_phone end,
        public.kratos_normalize_email(candidate_email)
      )
      returning id into canonical_customer_id;
    end if;

    update public.opportunities
    set customer_id = canonical_customer_id
    where id = quote_record.id;

    repaired_quotes := repaired_quotes + 1;
  end loop;

  select count(*) into remaining_orphans
  from public.opportunities o
  left join public.customers c
    on c.id = o.customer_id
    and coalesce(c.is_deleted, false) = false
  where o.customer_id is null or c.id is null;

  raise notice 'Customer quote integrity repair: duplicate phone groups %, duplicate email groups %, duplicate quote reassignments %, repaired orphan quotes %, remaining orphan quotes %',
    duplicate_phone_groups,
    duplicate_email_groups,
    reassigned_duplicate_quotes,
    repaired_quotes,
    remaining_orphans;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and conname = 'opportunities_customer_id_fkey'
  ) then
    alter table public.opportunities
      add constraint opportunities_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      not valid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and conname = 'opportunities_customer_id_fkey'
  ) then
    alter table public.opportunities validate constraint opportunities_customer_id_fkey;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from public.opportunities o
    left join public.customers c on c.id = o.customer_id
    where o.customer_id is null or c.id is null
  ) then
    alter table public.opportunities
      alter column customer_id set not null;
  else
    raise notice 'Skipped opportunities.customer_id NOT NULL because orphaned active quotes remain.';
  end if;
end $$;
