import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, isAdminRole, normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

const PAYMENT_METHODS = [
  'cash',
  'check',
  'credit_card_record',
  'debit_card_record',
  'interac_e_transfer',
  'wire_transfer',
] as const

const PAYMENT_STATUSES = ['recorded', 'received', 'pending', 'failed', 'refunded'] as const
const SENSITIVE_KEYS = ['card_number', 'cardNumber', 'cvv', 'cvc', 'expiry', 'expiration', 'exp_month', 'exp_year']

function amountToCents(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

function hasSensitivePaymentData(body: Record<string, unknown>) {
  return SENSITIVE_KEYS.some(key => key in body)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, profile } = auth.context

  const body = await req.json()
  if (hasSensitivePaymentData(body)) {
    return NextResponse.json({ error: 'Do not send card numbers, CVV, or expiry to Kratos CRM.' }, { status: 400 })
  }

  const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : null
  const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null
  let customerId = typeof body.customerId === 'string' ? body.customerId : null
  const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : ''
  const amountCents = amountToCents(body.amount)
  const paymentDate = typeof body.paymentDate === 'string' ? body.paymentDate : new Date().toISOString().slice(0, 10)
  const referenceNumber = typeof body.referenceNumber === 'string' && body.referenceNumber.trim()
    ? body.referenceNumber.trim()
    : null
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
  const status = typeof body.status === 'string' && PAYMENT_STATUSES.includes(body.status as typeof PAYMENT_STATUSES[number])
    ? body.status
    : 'recorded'

  if (!opportunityId) return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 })
  if (!PAYMENT_METHODS.includes(paymentMethod as typeof PAYMENT_METHODS[number])) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }
  if (!amountCents) return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 })

  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('id, customer_id, sales_agent_id, total_amount')
    .eq('id', opportunityId)
    .eq('is_deleted', false)
    .single()

  if (oppError || !opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  customerId = customerId ?? opportunity.customer_id
  const role = normalizeRole(profile.role)
  const isAssigned = opportunity.sales_agent_id === user.id
  const canRecord =
    isAdminRole(role) ||
    role === 'manager' ||
    (isAssigned && hasPermission(role, 'estimate:create'))

  if (!canRecord) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      opportunity_id: opportunityId,
      quote_id: quoteId,
      customer_id: customerId,
      method: paymentMethod,
      status,
      amount_cents: amountCents,
      currency: 'cad',
      provider: 'manual',
      reference_number: referenceNumber,
      notes,
      payment_date: paymentDate,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Manual payment insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('communications').insert({
    opportunity_id: opportunityId,
    customer_id: customerId,
    type: 'note',
    direction: 'internal',
    subject: 'Payment recorded',
    body: `Payment recorded: ${(amountCents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })} via ${paymentMethod.replace(/_/g, ' ')}.`,
    created_by: user.id,
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'payment_record_created',
    entityType: 'payment',
    entityId: payment.id,
    oldData: null,
    newData: payment as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(payment, { status: 201 })
}
