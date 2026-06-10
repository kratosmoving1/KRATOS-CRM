import { createClient } from '@/lib/supabase/server'
import { MOVE_SIZE_LABELS } from '@/lib/constants'
import type { DayDetailData, DispatchTruck, DispatchCrew, DispatchCrewMember } from './types'

export interface DispatchCalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  status: 'booked' | 'completed' | 'cancelled'
  customer_name: string
  move_size: string | null
  origin_city: string | null
  dest_city: string | null
  opportunity_number: string | null
  total: number | null
}

export async function fetchDispatchCalendarEvents(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<DispatchCalendarEvent[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      id, opportunity_number, status, service_date, move_size,
      origin_city, dest_city, total_amount,
      customer:customers!customer_id(id, full_name)
    `)
    .in('status', ['booked', 'completed'])
    .gte('service_date', rangeStart.toISOString().slice(0, 10))
    .lte('service_date', rangeEnd.toISOString().slice(0, 10))
    .eq('is_deleted', false)
    .order('service_date', { ascending: true })

  if (error) throw error

  return (data ?? []).map((opp: Record<string, unknown>) => mapOppToEvent(opp))
}

function mapOppToEvent(opp: Record<string, unknown>): DispatchCalendarEvent {
  const customer = opp.customer as { full_name?: string } | null
  const customerName = customer?.full_name?.trim() || 'Unknown Customer'
  const moveSizeLabel = opp.move_size
    ? (MOVE_SIZE_LABELS[opp.move_size as string] ?? String(opp.move_size).replace(/_/g, ' '))
    : 'Move'
  const dateStr = String(opp.service_date)
  const start = new Date(`${dateStr}T08:00:00`)
  const end = new Date(`${dateStr}T17:00:00`)

  return {
    id: String(opp.id),
    title: `${customerName} — ${moveSizeLabel}`,
    start,
    end,
    status: opp.status as 'booked' | 'completed' | 'cancelled',
    customer_name: customerName,
    move_size: opp.move_size as string | null,
    origin_city: opp.origin_city as string | null,
    dest_city: opp.dest_city as string | null,
    opportunity_number: opp.opportunity_number as string | null,
    total: opp.total_amount != null ? Number(opp.total_amount) : null,
  }
}

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const CREW_SELECT = `
  *,
  truck:dispatch_trucks(id, name, category, size, provider),
  driver:workforce_people!driver_id(id, name, profile_picture_url),
  dispatcher:workforce_people!dispatcher_id(id, name, profile_picture_url),
  helpers:dispatch_crew_helpers(
    person:workforce_people(id, name, profile_picture_url)
  ),
  assignments:dispatch_job_assignments(
    id, opportunity_id, crew_id, scheduled_date, start_time, duration_hours, position, is_deleted,
    opportunity:opportunities(
      id, opportunity_number, move_size, origin_city, dest_city, total_amount,
      customer:customers(id, full_name)
    )
  )
`

export async function fetchDayDetailData(date: string): Promise<DayDetailData> {
  const supabase = createClient()
  const dayDate = parseDateStr(date)

  const [trucksRes, peopleRes, eventsResult, crewsRes, cancelledRes] = await Promise.all([
    supabase
      .from('dispatch_trucks')
      .select('*')
      .neq('is_deleted', true)
      .eq('status', 'active')
      .order('category')
      .order('position'),
    supabase
      .from('workforce_people')
      .select(`
        id, name, role, profile_picture_url,
        role_data:workforce_roles(id, key, label, color),
        status:workforce_statuses(id, key, label, color),
        tier:workforce_tiers(id, key, label, color)
      `)
      .neq('is_deleted', true)
      .order('position'),
    fetchDispatchCalendarEvents(dayDate, dayDate),
    supabase
      .from('dispatch_crews')
      .select(CREW_SELECT)
      .eq('scheduled_date', date)
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('opportunities')
      .select(`
        id, opportunity_number, status, service_date, move_size,
        origin_city, dest_city, total_amount,
        customer:customers!customer_id(id, full_name)
      `)
      .eq('status', 'cancelled')
      .eq('service_date', date)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
  ])

  const rawCrews = (crewsRes.data ?? []) as unknown as DispatchCrew[]
  const crews = rawCrews.map(c => ({
    ...c,
    helpers: c.helpers ?? [],
    assignments: (c.assignments ?? []).filter(a => !a.is_deleted),
  }))

  const cancelledEvents = (cancelledRes.data ?? []).map((opp: Record<string, unknown>) => mapOppToEvent(opp))

  return {
    trucks: (trucksRes.data ?? []) as DispatchTruck[],
    crew_people: (peopleRes.data ?? []) as unknown as DispatchCrewMember[],
    events: eventsResult,
    cancelled_events: cancelledEvents,
    crews,
  }
}
