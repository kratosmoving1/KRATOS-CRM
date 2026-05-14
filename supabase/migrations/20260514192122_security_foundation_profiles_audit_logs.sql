-- ============================================================
-- Kratos CRM — Security foundation for profiles and audit logs
-- Purpose:
--   - Normalize user roles around CRM permissions.
--   - Tighten profile RLS away from broad authenticated access.
--   - Add immutable-style audit_logs for server-side security auditing.
-- ============================================================

create extension if not exists pgcrypto;

-- Profiles are the authorization source for authenticated CRM users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists role text not null default 'viewer',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
set role = case role
  when 'sales_manager' then 'manager'
  when 'ops_manager' then 'manager'
  when 'accountant' then 'manager'
  when 'senior_sales' then 'sales'
  when 'junior_sales' then 'sales'
  when 'admin' then 'admin'
  when 'dispatcher' then 'dispatcher'
  when 'owner' then 'owner'
  when 'manager' then 'manager'
  when 'sales' then 'sales'
  when 'crew' then 'crew'
  when 'viewer' then 'viewer'
  else 'viewer'
end
where role is distinct from case role
  when 'sales_manager' then 'manager'
  when 'ops_manager' then 'manager'
  when 'accountant' then 'manager'
  when 'senior_sales' then 'sales'
  when 'junior_sales' then 'sales'
  when 'admin' then 'admin'
  when 'dispatcher' then 'dispatcher'
  when 'owner' then 'owner'
  when 'manager' then 'manager'
  when 'sales' then 'sales'
  when 'crew' then 'crew'
  when 'viewer' then 'viewer'
  else 'viewer'
end;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'sales', 'dispatcher', 'crew', 'viewer'));

alter table public.profiles enable row level security;

drop policy if exists "auth users full access" on public.profiles;
drop policy if exists "Users can read own active profile" on public.profiles;
drop policy if exists "Owners and admins can read all profiles" on public.profiles;
drop policy if exists "Owners and admins can update profiles" on public.profiles;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('owner', 'admin')
  );
$func$;

create policy "Users can read own active profile"
on public.profiles
for select
to authenticated
using (id = auth.uid() and is_active = true);

create policy "Owners and admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.current_user_is_admin());

create policy "Owners and admins can update profiles"
on public.profiles
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- audit_logs records security-relevant mutations from server-side code.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Internal CRM user profiles and authorization roles.';
comment on table public.audit_logs is 'Server-side audit trail for security-relevant CRM mutations.';

create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "auth users full access" on public.audit_logs;
drop policy if exists "Owners and admins can read audit logs" on public.audit_logs;

create policy "Owners and admins can read audit logs"
on public.audit_logs
for select
to authenticated
using (public.current_user_is_admin());

-- Auth trigger defaults new users to least privilege until an owner/admin promotes them.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$func$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
