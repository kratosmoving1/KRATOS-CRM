import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'

const VALID_EVENT_TYPES = [
  'IPC', 'On-site Estimate', 'Survey', 'Follow-up', 'Call-back',
  'Internal Task', 'Meeting', 'Admin', 'Dispatch', 'Other',
] as const

const VALID_STATUSES = ['scheduled', 'completed', 'cancelled', 'no-show'] as const

function isIsoTimestamp(v: unknown): v is string {
  return typeof v === 'string' && !isNaN(Date.parse(v))
}

function canManageEvent(
  role: string,
  userId: string,
  event: { created_by: string | null; assigned_to: string | null },
) {
  if (['owner', 'admin', 'manager', 'dispatcher'].includes(role)) return true
  if (role === 'sales') {
    return event.created_by === userId || event.assigned_to === userId
  }
  return false
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { eventId: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { context } = auth

  const { data: existing, error: fetchErr } = await supabase
    .from('office_calendar_events')
    .select('id, title, event_type, start_at, status, created_by, assigned_to')
    .eq('id', params.eventId)
    .eq('is_deleted', false)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  if (!canManageEvent(context.role, context.user.id, existing)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title != null) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    }
    patch.title = body.title.trim()
  }
  if (body.event_type != null) {
    if (!VALID_EVENT_TYPES.includes(body.event_type as typeof VALID_EVENT_TYPES[number])) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
    }
    patch.event_type = body.event_type
  }
  if (body.start_at != null) {
    if (!isIsoTimestamp(body.start_at)) return NextResponse.json({ error: 'Invalid start_at' }, { status: 400 })
    patch.start_at = body.start_at
  }
  if (body.end_at !== undefined) {
    if (body.end_at != null && !isIsoTimestamp(body.end_at)) return NextResponse.json({ error: 'Invalid end_at' }, { status: 400 })
    patch.end_at = body.end_at ?? null
  }
  if (body.status != null) {
    if (!VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    patch.status = body.status
  }
  if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null
  if (body.location !== undefined) patch.location = body.location ? String(body.location).trim() : null
  if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to ?? null
  if (body.customer_id !== undefined) patch.customer_id = body.customer_id ?? null
  if (body.opportunity_id !== undefined) patch.opportunity_id = body.opportunity_id ?? null

  const { error: updateErr } = await supabase
    .from('office_calendar_events')
    .update(patch)
    .eq('id', params.eventId)

  if (updateErr) {
    console.error('Office event update error:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const action = patch.status && patch.status !== existing.status
    ? 'office_calendar_event_status_changed'
    : 'office_calendar_event_updated'

  await logAuditEvent({
    actorUserId: context.user.id,
    action,
    entityType: 'office_calendar_event',
    entityId: params.eventId,
    oldData: { title: existing.title, event_type: existing.event_type, status: existing.status } as import('@/types/database').Json,
    newData: patch as import('@/types/database').Json,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { eventId: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { context } = auth

  const { data: existing, error: fetchErr } = await supabase
    .from('office_calendar_events')
    .select('id, title, event_type, created_by, assigned_to')
    .eq('id', params.eventId)
    .eq('is_deleted', false)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  if (!canManageEvent(context.role, context.user.id, existing)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteErr } = await supabase
    .from('office_calendar_events')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', params.eventId)

  if (deleteErr) {
    console.error('Office event delete error:', deleteErr)
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: context.user.id,
    action: 'office_calendar_event_deleted',
    entityType: 'office_calendar_event',
    entityId: params.eventId,
    oldData: { title: existing.title, event_type: existing.event_type },
  })

  return new NextResponse(null, { status: 204 })
}
