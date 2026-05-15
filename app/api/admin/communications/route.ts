import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

const COMM_TYPES = ['note', 'email', 'call', 'sms'] as const
const DIRECTIONS = ['inbound', 'outbound', 'internal'] as const

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, profile } = auth.context

  const body = await req.json()

  if (!body.opportunity_id && !body.customer_id) {
    return NextResponse.json({ error: 'opportunity_id or customer_id required' }, { status: 400 })
  }
  if (!COMM_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (body.direction && !DIRECTIONS.includes(body.direction)) {
    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
  }
  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 })
  }

  let isAssigned = false
  if (body.opportunity_id) {
    const { data: opp } = await supabase
      .from('opportunities')
      .select('sales_agent_id')
      .eq('id', body.opportunity_id)
      .eq('is_deleted', false)
      .single()
    isAssigned = opp?.sales_agent_id === user.id
  } else if (body.customer_id) {
    const { data: opps } = await supabase
      .from('opportunities')
      .select('sales_agent_id')
      .eq('customer_id', body.customer_id)
      .eq('is_deleted', false)
    isAssigned = Boolean(opps?.some(opp => opp.sales_agent_id === user.id))
  }

  const canWriteAny = hasPermission(profile.role, 'lead:update') || hasPermission(profile.role, 'contact:update')
  const canWriteAssigned =
    isAssigned &&
    (hasPermission(profile.role, 'lead:update_assigned') || hasPermission(profile.role, 'contact:update_assigned'))

  if (!canWriteAny && !canWriteAssigned) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('communications')
    .insert({
      opportunity_id:        body.opportunity_id ?? null,
      customer_id:           body.customer_id ?? null,
      type:                  body.type,
      direction:             body.direction ?? 'outbound',
      subject:               body.subject ?? null,
      body:                  body.body.trim(),
      call_outcome:          body.call_outcome ?? null,
      call_duration_seconds: body.call_duration_seconds ?? null,
      email_to:              body.email_to ?? null,
      email_cc:              body.email_cc ?? null,
      created_by:            user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Communications POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'create',
    entityType: 'communication',
    entityId: data.id,
    oldData: null,
    newData: data as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(data, { status: 201 })
}
