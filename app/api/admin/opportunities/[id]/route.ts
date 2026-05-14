import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { STATUS_TIMESTAMP_MAP } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'
import { normalizeMoveSizeForDb, stripUnknownOpportunityColumns } from '@/lib/opportunityColumns'
import { hasPermission, isActiveUser, isAdminRole } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      customer:customers(*),
      agent:profiles!sales_agent_id(id, full_name, email, role),
      lead_source:lead_sources(id, name, category)
    `)
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Fetch audit log for this opportunity
  const { data: auditLog } = await supabase
    .from('audit_log')
    .select('*, user:profiles!user_id(full_name)')
    .eq('entity_type', 'opportunity')
    .eq('entity_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ ...data, audit_log: auditLog ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!isActiveUser(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  // Fetch current state for audit diff
  const { data: current } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canUpdateAssigned =
    current.sales_agent_id === user.id && hasPermission(profile?.role, 'lead:update_assigned')
  const canUpdateAny = hasPermission(profile?.role, 'lead:update')

  if (!canUpdateAny && !canUpdateAssigned) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isStatusChange = body.status && body.status !== current?.status

  // If status is changing, set timestamp
  const nowIso = new Date().toISOString()
  if (isStatusChange) {
    const tsKey = STATUS_TIMESTAMP_MAP[body.status as OppStatus]
    if (tsKey) body[tsKey] = nowIso
  }

  // Update pickup_city/dropoff_city when origin/dest cities change
  if (body.origin_city !== undefined) body.pickup_city  = body.origin_city
  if (body.dest_city   !== undefined) body.dropoff_city = body.dest_city
  if (body.move_size !== undefined) body.move_size = normalizeMoveSizeForDb(body.move_size)

  const updatePayload = stripUnknownOpportunityColumns(body)

  const { data, error } = await supabase
    .from('opportunities')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('Opportunity PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const action = isStatusChange ? 'status_change' : 'update'
  const diff = isStatusChange
    ? { from: current?.status, to: body.status, reason: body._reason ?? null }
    : updatePayload

  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action,
    diff,
  })

  await logAuditEvent({
    actorUserId: user.id,
    action,
    entityType: 'opportunity',
    entityId: params.id,
    oldData: current as unknown as Json,
    newData: data as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!isActiveUser(profile) || !isAdminRole(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: current } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', params.id)
    .single()

  const { error } = await supabase
    .from('opportunities')
    .update({ is_deleted: true })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'delete',
    diff:        null,
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'delete',
    entityType: 'opportunity',
    entityId: params.id,
    oldData: current as unknown as Json,
    newData: { is_deleted: true },
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}
