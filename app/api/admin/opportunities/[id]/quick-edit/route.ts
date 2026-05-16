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
    .select('id, customer_id, sales_agent_id')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canUpdateAny      = hasPermission(profile?.role, 'lead:update')
  const canUpdateAssigned = opp.sales_agent_id === user.id && hasPermission(profile?.role, 'lead:update_assigned')
  if (!canUpdateAny && !canUpdateAssigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { customerName, customerPhone, customerPhoneType, customerEmail } = await req.json()

  if (!customerName?.trim()) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
  if (!customerPhone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  if (String(customerPhone).replace(/\D/g, '').length !== 10) {
    return NextResponse.json({ error: 'Phone must be 10 digits' }, { status: 400 })
  }
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const { data: currentCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', opp.customer_id)
    .single()

  const customerPayload = {
    full_name:  customerName.trim(),
    phone:      String(customerPhone).replace(/\D/g, '') || null,
    phone_type: customerPhoneType || null,
    email:      customerEmail?.trim() || null,
  }

  const { data: updatedCustomer, error: custErr } = await supabase
    .from('customers')
    .update(customerPayload)
    .eq('id', opp.customer_id)
    .select()
    .single()

  if (custErr) {
    console.error('QuickEdit customer update error:', custErr)
    return NextResponse.json({ error: custErr.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'update',
    entityType: 'customer',
    entityId: opp.customer_id,
    oldData: currentCustomer as unknown as Json,
    newData: updatedCustomer as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  await supabase.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'update',
    diff:        { event: 'customer_quick_updated', customer: customerPayload },
  })

  return NextResponse.json({ ok: true, customer: updatedCustomer })
}
