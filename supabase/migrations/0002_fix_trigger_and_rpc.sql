-- ============================================================
-- Patch: Fix handle_new_user trigger + add get_dashboard_data RPC
-- Run this in Supabase SQL Editor if the trigger or RPC is missing.
-- ============================================================

-- Updated-at helper (safe to re-run)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-create profile when a new auth user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'junior_sales'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles for each row execute function set_updated_at();

drop trigger if exists customers_set_updated_at on customers;
create trigger customers_set_updated_at
  before update on customers for each row execute function set_updated_at();

drop trigger if exists opportunities_set_updated_at on opportunities;
create trigger opportunities_set_updated_at
  before update on opportunities for each row execute function set_updated_at();

-- ============================================================
-- Dashboard RPC Function
-- ============================================================

create or replace function get_dashboard_data()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_today date := current_date;
  v_month_start timestamptz := date_trunc('month', now());
  v_month_end   timestamptz := date_trunc('month', now()) + interval '1 month';
  v_week_start  timestamptz := date_trunc('week', now());
  v_week_end    timestamptz := date_trunc('week', now()) + interval '1 week';
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end   timestamptz := date_trunc('day', now()) + interval '1 day';

  v_moves_month       int;
  v_revenue_month     numeric;
  v_jobs_today        int;
  v_avg_profit        numeric;
  v_avg_move_value    numeric;

  v_leads_today int; v_leads_week  int; v_leads_month  int;
  v_quotes_today int; v_quotes_week int; v_quotes_month int;
  v_booked_today int; v_booked_week int; v_booked_month int;
  v_cancel_today int; v_cancel_week int; v_cancel_month int;

  v_unassigned_leads int;
  v_new_leads        int;
  v_accepted         int;
  v_stale            int;

  result jsonb;
begin
  select count(*)::int, coalesce(sum(total_amount), 0)
  into v_moves_month, v_revenue_month
  from opportunities
  where is_deleted = false
    and booked_at >= v_month_start and booked_at < v_month_end;

  select count(*)::int into v_jobs_today
  from opportunities
  where is_deleted = false
    and service_date = v_today
    and status in ('booked','completed');

  select case when count(distinct customer_id) > 0
    then coalesce(sum(total_amount - estimated_cost), 0) / count(distinct customer_id)::numeric
    else 0 end
  into v_avg_profit
  from opportunities
  where is_deleted = false
    and status = 'completed'
    and completed_at >= v_month_start and completed_at < v_month_end;

  select coalesce(avg(total_amount), 0) into v_avg_move_value
  from opportunities
  where is_deleted = false
    and booked_at >= v_month_start and booked_at < v_month_end;

  select
    count(*) filter (where created_at >= v_today_start and created_at < v_today_end)::int,
    count(*) filter (where created_at >= v_week_start  and created_at < v_week_end)::int,
    count(*) filter (where created_at >= v_month_start and created_at < v_month_end)::int
  into v_leads_today, v_leads_week, v_leads_month
  from opportunities where is_deleted = false;

  select
    count(*) filter (where quote_sent_at >= v_today_start and quote_sent_at < v_today_end)::int,
    count(*) filter (where quote_sent_at >= v_week_start  and quote_sent_at < v_week_end)::int,
    count(*) filter (where quote_sent_at >= v_month_start and quote_sent_at < v_month_end)::int
  into v_quotes_today, v_quotes_week, v_quotes_month
  from opportunities where is_deleted = false;

  select
    count(*) filter (where booked_at >= v_today_start and booked_at < v_today_end)::int,
    count(*) filter (where booked_at >= v_week_start  and booked_at < v_week_end)::int,
    count(*) filter (where booked_at >= v_month_start and booked_at < v_month_end)::int
  into v_booked_today, v_booked_week, v_booked_month
  from opportunities where is_deleted = false;

  select
    count(*) filter (where cancelled_at >= v_today_start and cancelled_at < v_today_end)::int,
    count(*) filter (where cancelled_at >= v_week_start  and cancelled_at < v_week_end)::int,
    count(*) filter (where cancelled_at >= v_month_start and cancelled_at < v_month_end)::int
  into v_cancel_today, v_cancel_week, v_cancel_month
  from opportunities where is_deleted = false;

  select count(*)::int into v_unassigned_leads
  from opportunities where is_deleted = false and sales_agent_id is null and status = 'new_lead';

  select count(*)::int into v_new_leads
  from opportunities where is_deleted = false and status = 'new_lead';

  select count(*)::int into v_accepted
  from opportunities where is_deleted = false and status = 'accepted';

  select count(*)::int into v_stale
  from opportunities
  where is_deleted = false
    and status not in ('booked','completed','cancelled','lost')
    and created_at < now() - interval '7 days';

  select jsonb_build_object(
    'movesThisMonth',        v_moves_month,
    'revenueThisMonth',      v_revenue_month,
    'jobsToday',             v_jobs_today,
    'avgProfitPerCustomer',  v_avg_profit,
    'avgMoveValueThisMonth', v_avg_move_value,
    'activity', jsonb_build_object(
      'today', jsonb_build_object('leads', v_leads_today, 'quotesSent', v_quotes_today, 'booked', v_booked_today, 'cancellations', v_cancel_today),
      'week',  jsonb_build_object('leads', v_leads_week,  'quotesSent', v_quotes_week,  'booked', v_booked_week,  'cancellations', v_cancel_week),
      'month', jsonb_build_object('leads', v_leads_month, 'quotesSent', v_quotes_month, 'booked', v_booked_month, 'cancellations', v_cancel_month)
    ),
    'openItems', jsonb_build_object(
      'unassignedLeads', v_unassigned_leads, 'newLeads', v_new_leads,
      'acceptedNotBooked', v_accepted, 'staleOpportunities', v_stale
    ),
    'salesLeaders', (
      select coalesce(jsonb_agg(jsonb_build_object('agent_name', p.full_name, 'moves', sl.moves, 'revenue', sl.revenue) order by sl.revenue desc), '[]'::jsonb)
      from (
        select sales_agent_id, count(*)::int as moves, coalesce(sum(total_amount), 0) as revenue
        from opportunities
        where is_deleted = false and booked_at >= v_month_start and booked_at < v_month_end and sales_agent_id is not null
        group by sales_agent_id order by revenue desc limit 5
      ) sl join profiles p on p.id = sl.sales_agent_id
    ),
    'referralSources', (
      select coalesce(jsonb_agg(jsonb_build_object('source_name', rs.name, 'moves', rs.moves, 'revenue', rs.revenue) order by rs.revenue desc), '[]'::jsonb)
      from (
        select ls.name, count(*)::int as moves, coalesce(sum(o.total_amount), 0) as revenue
        from opportunities o
        join lead_sources ls on ls.id = o.lead_source_id
        where o.is_deleted = false and o.booked_at >= v_month_start and o.booked_at < v_month_end
        group by ls.name order by revenue desc limit 5
      ) rs
    ),
    'monthlyRevenue', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.month_start, 'Mon YYYY'), 'revenue', coalesce(rev.revenue, 0)) order by m.month_start), '[]'::jsonb)
      from (
        select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as month_start
      ) m
      left join (
        select date_trunc('month', booked_at) as month_start, sum(total_amount) as revenue
        from opportunities where is_deleted = false and booked_at is not null group by 1
      ) rev using (month_start)
    )
  ) into result;

  return result;
end;
$$;
