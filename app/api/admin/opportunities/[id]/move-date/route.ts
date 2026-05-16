import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, isActiveUser } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

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

  const { data: opp } = await supabase
    .from('opportunities')
    .select('id, sales_agent_id, service_date')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canUpdateAny      = hasPermission(profile?.role, 'lead:update')
  const canUpdateAssigned = opp.sales_agent_id === user.id && hasPermission(profile?.role, 'lead:update_assigned')
  if (!canUpdateAny && !canUpdateAssigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { serviceDate, tbd } = await req.json()

  const newDate = tbd ? null : (serviceDate || null)

  const { data: updated, error } = await supabase
    .from('opportunities')
    .update({ service_date: newDate })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('move-date PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'update',
    diff:        { event: 'opportunity_move_date_updated', from: opp.service_date, to: newDate },
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'update',
    entityType: 'opportunity',
    entityId: params.id,
    oldData: { service_date: opp.service_date } as unknown as Json,
    newData: { service_date: newDate } as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true, service_date: newDate, opportunity: updated })
}
