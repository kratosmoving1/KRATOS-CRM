import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, isAdminRole, normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { sendEmail } from '@/lib/email/sendEmail'
import type { Json } from '@/types/database'

const PAYMENT_METHODS = [
  'cash',
  'check',
  'credit_card_record',
  'debit_card_record',
  'interac_e_transfer',
  'wire_transfer',
] as const

const SENSITIVE_KEYS = ['card_number', 'cardNumber', 'cvv', 'cvc', 'expiry', 'expiration', 'exp_month', 'exp_year']

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', check: 'Cheque',
  credit_card_record: 'Credit Card', debit_card_record: 'Debit Card',
  interac_e_transfer: 'Interac e-Transfer', wire_transfer: 'Wire Transfer',
}

function amountToCents(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

function hasSensitivePaymentData(body: Record<string, unknown>) {
  return SENSITIVE_KEYS.some(key => key in body)
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })
}

function buildReceiptHtml(params: {
  customerName: string
  amount: string
  method: string
  date: string
  quoteNumber: string
  referenceNumber: string | null
  notes: string | null
}) {
  const { customerName, amount, method, date, quoteNumber, referenceNumber, notes } = params
  const firstName = customerName.split(' ')[0] || customerName
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #334155;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffad33;">Kratos Moving</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">Payment Received</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">Thank you, ${firstName}. Your payment has been recorded.</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Payment details</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#64748b;width:40%">Amount</td>
                  <td style="padding:6px 0;font-size:16px;font-weight:700;color:#ffad33;text-align:right">${amount}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#64748b">Method</td>
                  <td style="padding:6px 0;font-size:13px;color:#f8fafc;text-align:right">${method}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#64748b">Date</td>
                  <td style="padding:6px 0;font-size:13px;color:#f8fafc;text-align:right">${date}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#64748b">Quote</td>
                  <td style="padding:6px 0;font-size:13px;color:#f8fafc;text-align:right">${quoteNumber}</td>
                </tr>
                ${referenceNumber ? `<tr>
                  <td style="padding:6px 0;font-size:13px;color:#64748b">Reference #</td>
                  <td style="padding:6px 0;font-size:13px;color:#f8fafc;text-align:right">${referenceNumber}</td>
                </tr>` : ''}
                ${notes ? `<tr>
                  <td colspan="2" style="padding:12px 0 0;font-size:12px;color:#64748b;border-top:1px solid #1e293b;margin-top:8px">${notes}</td>
                </tr>` : ''}
              </table>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;color:#64748b;text-align:center;line-height:1.6;">Questions? Call us at <strong style="color:#94a3b8;">(800) 321-3222</strong> or reply to this email.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #334155;">
          <p style="margin:0;font-size:12px;color:#334155;">Kratos Moving Inc. &mdash; Ontario, Canada</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildReceiptText(params: {
  customerName: string
  amount: string
  method: string
  date: string
  quoteNumber: string
  referenceNumber: string | null
}) {
  const { customerName, amount, method, date, quoteNumber, referenceNumber } = params
  return `Hi ${customerName.split(' ')[0]},\n\nYour payment of ${amount} has been received.\n\nMethod: ${method}\nDate: ${date}\nQuote: ${quoteNumber}${referenceNumber ? `\nReference: ${referenceNumber}` : ''}\n\nThank you for choosing Kratos Moving.\n\nQuestions? Call (800) 321-3222.\n\n— Kratos Moving Inc.`
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
  const sendReceipt = body.sendReceipt === true

  if (!opportunityId) return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 })
  if (!PAYMENT_METHODS.includes(paymentMethod as typeof PAYMENT_METHODS[number])) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }
  if (!amountCents) return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 })

  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select('id, opportunity_number, customer_id, sales_agent_id, total_amount, customer:customers!customer_id(full_name, email)')
    .eq('id', opportunityId)
    .not('is_deleted', 'is', true)
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
      status: 'received',
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
    body: `Payment recorded: ${formatCurrency(amountCents)} via ${METHOD_LABELS[paymentMethod] ?? paymentMethod}.`,
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

  // Send receipt email if agent requested it and customer has an email address
  let receiptSent = false
  let receiptError: string | null = null

  if (sendReceipt) {
    const rawCustomer = opportunity.customer as unknown
    const customer = Array.isArray(rawCustomer) ? (rawCustomer[0] ?? null) : rawCustomer as { full_name: string; email: string | null } | null
    const customerEmail = customer?.email ?? null
    const customerName = customer?.full_name ?? 'Customer'

    if (!customerEmail) {
      receiptError = 'No email on file for this customer — receipt not sent.'
    } else {
      const formattedDate = new Date(paymentDate + 'T12:00:00').toLocaleDateString('en-CA', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
      const receiptParams = {
        customerName,
        amount: formatCurrency(amountCents),
        method: METHOD_LABELS[paymentMethod] ?? paymentMethod,
        date: formattedDate,
        quoteNumber: opportunity.opportunity_number ?? opportunityId,
        referenceNumber,
        notes,
      }
      try {
        await sendEmail({
          to: customerEmail,
          subject: `Payment receipt — Kratos Moving Quote #${opportunity.opportunity_number}`,
          html: buildReceiptHtml(receiptParams),
          text: buildReceiptText(receiptParams),
          fromName: 'Kratos Moving',
        })
        receiptSent = true
      } catch (e) {
        receiptError = `Payment recorded, but receipt email failed: ${e instanceof Error ? e.message : 'Unknown error'}`
      }
    }
  }

  return NextResponse.json({ ...payment, receiptSent, receiptError }, { status: 201 })
}
