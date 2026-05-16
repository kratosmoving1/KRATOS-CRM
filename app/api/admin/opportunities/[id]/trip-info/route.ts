import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, isActiveUser, normalizeRole } from '@/lib/auth/permissions'
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
    .select('id, sales_agent_id, origin_address_line1, origin_city, dest_address_line1, dest_city')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = normalizeRole(profile?.role)
  const canUpdateByRole = ['owner', 'admin', 'manager', 'sales', 'dispatcher'].includes(role)
  const canUpdateAny      = hasPermission(profile?.role, 'lead:update')
  const canUpdateAssigned = opp.sales_agent_id === user.id && hasPermission(profile?.role, 'lead:update_assigned')
  if (!canUpdateByRole && !canUpdateAny && !canUpdateAssigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { prefix } = body

  if (prefix !== 'origin' && prefix !== 'dest') {
    return NextResponse.json({ error: 'Invalid prefix' }, { status: 400 })
  }

  const p = prefix as 'origin' | 'dest'

  const updatePayload: Record<string, unknown> = {
    [`${p}_address_line1`]:  body.address_line1  ?? null,
    [`${p}_address_line2`]:  body.address_line2  ?? null,
    [`${p}_city`]:           body.city           ?? null,
    [`${p}_province`]:       body.province       ?? null,
    [`${p}_postal_code`]:    body.postal_code    ?? null,
    [`${p}_place_id`]:       body.place_id       ?? null,
    [`${p}_dwelling_type`]:  body.dwelling_type  || null,
    [`${p}_floor`]:          body.floor != null ? Number(body.floor) || null : null,
    [`${p}_has_elevator`]:   body.has_elevator   ?? false,
    [`${p}_stairs_count`]:   body.stairs_count != null ? Number(body.stairs_count) || null : null,
    [`${p}_long_carry`]:     body.long_carry     ?? false,
    [`${p}_parking_notes`]:  body.parking_notes  || null,
  }

  const oldData = prefix === 'origin'
    ? { address: opp.origin_address_line1, city: opp.origin_city }
    : { address: opp.dest_address_line1,   city: opp.dest_city }

  const { data: updated, error } = await supabase
    .from('opportunities')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('trip-info PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'update',
    diff:        { event: `opportunity_${p}_address_updated`, old: oldData, new: updatePayload },
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'update',
    entityType: 'opportunity',
    entityId: params.id,
    oldData: oldData as unknown as Json,
    newData: updatePayload as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true, opportunity: updated })
}
