import { createClient } from '@/lib/supabase/server'
import { MOVE_SIZE_LABELS } from '@/lib/constants'

export interface DispatchCalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  status: 'booked' | 'completed'
  customer_name: string
  move_size: string | null
  origin_city: string | null
  dest_city: string | null
  opportunity_number: string | null
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
      origin_city, dest_city,
      customer:customers!customer_id(id, full_name)
    `)
    .in('status', ['booked', 'completed'])
    .gte('service_date', rangeStart.toISOString().slice(0, 10))
    .lte('service_date', rangeEnd.toISOString().slice(0, 10))
    .eq('is_deleted', false)
    .order('service_date', { ascending: true })

  if (error) throw error

  return (data ?? []).map((opp: Record<string, unknown>) => {
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
      status: opp.status as 'booked' | 'completed',
      customer_name: customerName,
      move_size: opp.move_size as string | null,
      origin_city: opp.origin_city as string | null,
      dest_city: opp.dest_city as string | null,
      opportunity_number: opp.opportunity_number as string | null,
    }
  })
}
