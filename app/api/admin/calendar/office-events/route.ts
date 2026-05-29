import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { hasPermission } from '@/lib/auth/permissions'

const VALID_EVENT_TYPES = [
  'IPC', 'On-site Estimate', 'Survey', 'Follow-up', 'Call-back',
  'Internal Task', 'Meeting', 'Admin', 'Dispatch', 'Other',
] as const

const VALID_STATUSES = ['scheduled', 'completed', 'cancelled', 'no-show'] as const

function isDate(v: string | null): v is string {
  return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v))
}

function isIsoTimestamp(v: unknown): v is string {
  return typeof v === 'string' && !isNaN(Date.parse(v))
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { context } = auth

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: 'Valid start and end dates required' }, { status: 400 })
  }

  // Sales can only see their own events
  const isSalesOnly = context.role === 'sales'

  let query = supabase
    .from('office_calendar_events')
    .select(`
      id, title, description, event_type, start_at, end_at, location, status,
      assigned_to, customer_id, opportunity_id, created_by,
      assignee:profiles!assigned_to(id, full_name),
      customer:customers!customer_id(id, full_name),
      opportunity:opportunities!opportunity_id(id, opportunity_number)
    `)
    .eq('is_deleted', false)
    .gte('start_at', `${start}T00:00:00`)
    .lte('start_at', `${end}T23:59:59`)
    .order('start_at', { ascending: true })

  if (isSalesOnly) {
    query = query.or(`assigned_to.eq.${context.user.id},created_by.eq.${context.user.id}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Office calendar events fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { context } = auth

  // Crew and viewer cannot create events
  if (!hasPermission(context.role, 'job:read')) {
    const allowed = ['owner', 'admin', 'manager', 'sales', 'dispatcher'].includes(context.role)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, event_type, start_at, end_at, assigned_to, customer_id, opportunity_id, location, description, status } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!event_type || !VALID_EVENT_TYPES.includes(event_type as typeof VALID_EVENT_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
  }
  if (!isIsoTimestamp(start_at)) {
    return NextResponse.json({ error: 'start_at must be a valid timestamp' }, { status: 400 })
  }
  if (end_at != null && !isIsoTimestamp(end_at)) {
    return NextResponse.json({ error: 'end_at must be a valid timestamp' }, { status: 400 })
  }
  const resolvedStatus = VALID_STATUSES.includes(status as typeof VALID_STATUSES[number]) ? status : 'scheduled'

  const { data: inserted, error } = await supabase
    .from('office_calendar_events')
    .insert({
      title: (title as string).trim(),
      description: description ? String(description).trim() : null,
      event_type: event_type as string,
      start_at: start_at as string,
      end_at: (end_at as string | null) ?? null,
      assigned_to: (assigned_to as string | null) ?? null,
      customer_id: (customer_id as string | null) ?? null,
      opportunity_id: (opportunity_id as string | null) ?? null,
      location: location ? String(location).trim() : null,
      status: resolvedStatus as string,
      created_by: context.user.id,
    })
    .select('id, title, event_type, start_at')
    .single()

  if (error) {
    console.error('Office event create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: context.user.id,
    action: 'office_calendar_event_created',
    entityType: 'office_calendar_event',
    entityId: inserted.id,
    newData: { title: inserted.title, event_type: inserted.event_type, start_at: inserted.start_at },
  })

  return NextResponse.json({ data: inserted }, { status: 201 })
}
