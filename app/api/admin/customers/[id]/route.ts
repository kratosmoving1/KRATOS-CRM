import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

const ALLOWED_CUSTOMER_UPDATE_COLUMNS = new Set([
  'full_name',
  'email',
  'phone',
  'phone_type',
  'secondary_phone',
  'secondary_phone_type',
  'notes',
])

function stripUnknownCustomerColumns(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => ALLOWED_CUSTOMER_UPDATE_COLUMNS.has(key)),
  )
}

function isAssignedCustomerOpportunity(opps: Array<{ sales_agent_id: string | null }> | null, userId: string) {
  return Boolean(opps?.some(opp => opp.sales_agent_id === userId))
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: opportunities } = await supabase
    .from('opportunities')
    .select(`
      *,
      agent:profiles!sales_agent_id(id, full_name),
      lead_source:lead_sources(id, name)
    `)
    .eq('customer_id', params.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  return NextResponse.json({ ...customer, opportunities: opportunities ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, profile } = auth.context

  const body = await req.json()
  const updatePayload = stripUnknownCustomerColumns(body)

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No valid customer fields provided' }, { status: 400 })
  }
  if (typeof updatePayload.full_name === 'string' && !updatePayload.full_name.trim()) {
    return NextResponse.json({ error: 'Customer name cannot be blank' }, { status: 400 })
  }
  if (typeof updatePayload.email === 'string' && updatePayload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatePayload.email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const { data: current, error: currentErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .single()

  if (currentErr || !current) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const { data: assignedOpps } = await supabase
    .from('opportunities')
    .select('sales_agent_id')
    .eq('customer_id', params.id)
    .eq('is_deleted', false)

  const canUpdateAny = hasPermission(profile.role, 'contact:update')
  const canUpdateAssigned =
    hasPermission(profile.role, 'contact:update_assigned') &&
    isAssignedCustomerOpportunity(assignedOpps, user.id)

  if (!canUpdateAny && !canUpdateAssigned) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('customers')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'update',
    entityType: 'customer',
    entityId: params.id,
    oldData: current as unknown as Json,
    newData: data as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(data)
}
