import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { sendEmail } from '@/lib/email/sendEmail'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import { calculateEstimate } from '@/lib/charges/calculate'

const COMPANY_PHONE = process.env.COMPANY_PHONE ?? '(800) 321-3222'
const KRATOS_ORANGE = '#ffad33'
const HEADER_BG     = '#0a0a0a'
const KRATOS_DARK   = '#0f172a'

function moneyNum(n: number) {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })
}

interface InvoiceCharge {
  name: string
  subtotal: number
  discount_amount: number
  total: number
}

function buildInvoiceHtml(p: {
  customerFirstName: string
  customerFullName: string
  quoteNumber: string
  moveDate: string
  serviceType: string
  originAddress: string
  destinationAddress: string
  charges: InvoiceCharge[]
  subtotal: number
  discounts: number
  salesTax: number
  estimateTotal: number
  totalPaid: number
  balanceDue: number
  agentFirstName: string
  agentLastInitial: string
  companyPhone: string
}): string {
  const agentLine = p.agentLastInitial ? `${p.agentFirstName} ${p.agentLastInitial}.` : p.agentFirstName

  const chargeRows = p.charges.map(c => `
    <tr>
      <td style="padding:10px 0;font-size:14px;color:${KRATOS_DARK};border-bottom:1px solid #e2e8f0">${c.name}</td>
      <td style="padding:10px 0;font-size:14px;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0">${moneyNum(c.subtotal)}</td>
      <td style="padding:10px 0;font-size:14px;color:#10b981;text-align:right;border-bottom:1px solid #e2e8f0">${c.discount_amount > 0 ? `&minus; ${moneyNum(c.discount_amount)}` : '&mdash;'}</td>
      <td style="padding:10px 0;font-size:14px;font-weight:600;color:${KRATOS_DARK};text-align:right;border-bottom:1px solid #e2e8f0">${moneyNum(c.total)}</td>
    </tr>`).join('')

  const discountRows = p.discounts > 0 ? `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#64748b">Discounts</td>
      <td style="padding:8px 0;font-size:14px;color:#10b981;text-align:right">&minus; ${moneyNum(p.discounts)}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#64748b">Subtotal (Less Discounts)</td>
      <td style="padding:8px 0;font-size:14px;color:${KRATOS_DARK};text-align:right">${moneyNum(p.subtotal - p.discounts)}</td>
    </tr>` : ''

  const paymentsRow = p.totalPaid > 0 ? `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#64748b">Payments Received</td>
      <td style="padding:8px 0;font-size:14px;color:#10b981;text-align:right">&minus; ${moneyNum(p.totalPaid)}</td>
    </tr>` : ''

  const addressRow = (p.originAddress || p.destinationAddress) ? `
    <tr>
      <td colspan="3" style="padding:0 20px 16px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">From &rarr; To</p>
        <p style="margin:0;font-size:13px;color:#475569">${p.originAddress || '&mdash;'} &rarr; ${p.destinationAddress || '&mdash;'}</p>
      </td>
    </tr>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Invoice &mdash; Kratos Moving</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

      <!-- Header -->
      <tr><td align="center" style="background:${HEADER_BG};padding:32px 40px">
        <img src="https://kratos-crm.vercel.app/logo.png" alt="Kratos Moving" height="72" style="height:72px;width:auto;display:block;margin:0 auto" />
      </td></tr>

      <!-- Invoice heading -->
      <tr><td style="padding:36px 40px 0">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <h1 style="margin:0;font-size:26px;font-weight:bold;color:${KRATOS_DARK}">Invoice</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#64748b">Quote #${p.quoteNumber}</p>
            </td>
            <td style="text-align:right;vertical-align:top">
              ${p.balanceDue > 0
                ? `<span style="background:#fef2f2;color:#dc2626;font-size:13px;font-weight:bold;padding:6px 16px;border-radius:99px;display:inline-block">BALANCE DUE: ${moneyNum(p.balanceDue)}</span>`
                : `<span style="background:#f0fdf4;color:#16a34a;font-size:13px;font-weight:bold;padding:6px 16px;border-radius:99px;display:inline-block">PAID IN FULL</span>`}
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Move details -->
      <tr><td style="padding:24px 40px 0">
        <table cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border-radius:6px">
          <tr>
            <td style="padding:16px 20px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">Customer</p>
              <p style="margin:0;font-size:14px;font-weight:600;color:${KRATOS_DARK}">${p.customerFullName}</p>
            </td>
            <td style="padding:16px 20px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">Move Date</p>
              <p style="margin:0;font-size:14px;font-weight:600;color:${KRATOS_DARK}">${p.moveDate}</p>
            </td>
            <td style="padding:16px 20px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">Service</p>
              <p style="margin:0;font-size:14px;font-weight:600;color:${KRATOS_DARK}">${p.serviceType}</p>
            </td>
          </tr>
          ${addressRow}
        </table>
      </td></tr>

      <!-- Charge Summary -->
      <tr><td style="padding:28px 40px 0">
        <p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:${KRATOS_DARK}">Charge Summary</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          <thead>
            <tr style="border-bottom:2px solid #e2e8f0">
              <th style="padding:8px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;text-align:left">Charge</th>
              <th style="padding:8px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;text-align:right">Subtotal</th>
              <th style="padding:8px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;text-align:right">Discount</th>
              <th style="padding:8px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${chargeRows || `<tr><td colspan="4" style="padding:16px 0;font-size:14px;color:#94a3b8;text-align:center">No charges on file</td></tr>`}
          </tbody>
        </table>
      </td></tr>

      <!-- Totals -->
      <tr><td style="padding:20px 40px 0">
        <table cellpadding="0" cellspacing="0" style="margin-left:auto;min-width:240px">
          <tr>
            <td style="padding:8px 0 2px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;border-bottom:1px solid #e2e8f0" colspan="2">Summary</td>
          </tr>
          <tr>
            <td style="padding:10px 0 4px;font-size:14px;color:#64748b">Subtotal</td>
            <td style="padding:10px 0 4px;font-size:14px;color:${KRATOS_DARK};text-align:right;padding-left:40px">${moneyNum(p.subtotal)}</td>
          </tr>
          ${discountRows}
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#64748b">HST (13%)</td>
            <td style="padding:4px 0;font-size:14px;color:${KRATOS_DARK};text-align:right;padding-left:40px">${moneyNum(p.salesTax)}</td>
          </tr>
          <tr style="border-top:2px solid ${KRATOS_DARK}">
            <td style="padding:12px 0 8px;font-size:16px;font-weight:bold;color:${KRATOS_DARK}">Grand Total</td>
            <td style="padding:12px 0 8px;font-size:16px;font-weight:bold;color:${KRATOS_DARK};text-align:right;padding-left:40px">${moneyNum(p.estimateTotal)}</td>
          </tr>
          ${paymentsRow}
          <tr>
            <td style="padding:8px 0;font-size:16px;font-weight:bold;color:${p.balanceDue > 0 ? '#dc2626' : '#16a34a'}">Balance Due</td>
            <td style="padding:8px 0;font-size:16px;font-weight:bold;color:${p.balanceDue > 0 ? '#dc2626' : '#16a34a'};text-align:right;padding-left:40px">${p.balanceDue > 0 ? moneyNum(p.balanceDue) : 'Paid in full'}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;margin-top:32px;text-align:center">
        <p style="margin:0 0 4px;font-size:13px;color:#64748b;line-height:1.6">
          Questions? Call us at <strong>${p.companyPhone}</strong>.
        </p>
        ${agentLine ? `<p style="margin:0 0 4px;font-size:13px;color:#64748b">Your Kratos specialist: <strong>${agentLine}</strong> &middot; Quote #${p.quoteNumber}</p>` : `<p style="margin:0 0 4px;font-size:13px;color:#64748b">Quote #${p.quoteNumber}</p>`}
        <p style="margin:8px 0 0;font-size:14px;font-weight:bold;color:${KRATOS_ORANGE}">Done As Promised.</p>
      </td></tr>

    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center">
      Kratos Moving Inc. &middot; 1 (800) 321-3222 &middot; kratosmoving.com
    </p>
  </td></tr>
</table>
</body>
</html>`
}

// ── Shared data loader ─────────────────────────────────────────────────────────

type InvoicePayload =
  | { ok: false; error: string; status: number }
  | {
      ok: true
      html: string
      subject: string
      text: string
      customerEmail: string
      customerId: string
      customerFirstName: string
    }

async function buildInvoicePayload(opportunityId: string): Promise<InvoicePayload> {
  const admin = createAdminClient()
  const [oppResult, chargesResult, paymentsResult] = await Promise.all([
    admin
      .from('opportunities')
      .select('id, opportunity_number, service_type, service_date, origin_address_line1, origin_city, origin_province, dest_address_line1, dest_city, dest_province, customer:customers!customer_id(id, full_name, email), agent:profiles!sales_agent_id(full_name)')
      .eq('id', opportunityId)
      .not('is_deleted', 'is', 'true')
      .single(),
    admin
      .from('opportunity_charges')
      .select('name, subtotal, discount_amount, total')
      .eq('opportunity_id', opportunityId)
      .not('is_deleted', 'is', 'true')
      .order('created_at', { ascending: true }),
    admin
      .from('payments')
      .select('amount_cents, status')
      .eq('opportunity_id', opportunityId)
      .not('is_deleted', 'is', 'true'),
  ])

  const opp = oppResult.data
  if (oppResult.error || !opp) return { ok: false, error: 'Opportunity not found', status: 404 }

  type CustomerField = { id: string; full_name: string; email: string | null }[] | { id: string; full_name: string; email: string | null } | null
  type AgentField    = { full_name: string | null }[] | { full_name: string | null } | null

  const rawCustomer = opp.customer as CustomerField
  const rawAgent    = opp.agent as AgentField
  const customerRow = Array.isArray(rawCustomer) ? rawCustomer[0] ?? null : rawCustomer
  const agentRow    = Array.isArray(rawAgent) ? rawAgent[0] ?? null : rawAgent

  if (!customerRow?.email) return { ok: false, error: 'No email address on file for this customer', status: 422 }

  const charges = (chargesResult.data ?? []) as InvoiceCharge[]
  const allPayments = paymentsResult.data ?? []
  const totalPaid = allPayments
    .filter(p => p.status !== 'failed' && p.status !== 'refunded')
    .reduce((sum, p) => sum + (p.amount_cents ?? 0) / 100, 0)

  const totals      = calculateEstimate(charges, 0.13, false)
  const balanceDue  = Math.max(totals.estimate_total - totalPaid, 0)
  const quoteNumber = formatQuoteNumber(opp.opportunity_number)

  const moveDateLabel    = opp.service_date
    ? new Date(opp.service_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'To be confirmed'
  const serviceTypeLabel = String(opp.service_type ?? 'Moving').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const origin           = [opp.origin_address_line1, opp.origin_city, opp.origin_province].filter(Boolean).join(', ')
  const destination      = [opp.dest_address_line1, opp.dest_city, opp.dest_province].filter(Boolean).join(', ')
  const agentParts       = agentRow?.full_name?.trim().split(/\s+/) ?? []
  const agentFirstName   = agentParts[0] ?? ''
  const agentLastInitial = agentParts[1]?.[0] ?? ''
  const customerFirstName = customerRow.full_name.trim().split(/\s+/)[0] ?? customerRow.full_name

  const html = buildInvoiceHtml({
    customerFirstName,
    customerFullName: customerRow.full_name,
    quoteNumber,
    moveDate: moveDateLabel,
    serviceType: serviceTypeLabel,
    originAddress: origin,
    destinationAddress: destination,
    charges,
    subtotal: totals.subtotal,
    discounts: totals.total_discounts,
    salesTax: totals.sales_tax,
    estimateTotal: totals.estimate_total,
    totalPaid,
    balanceDue,
    agentFirstName,
    agentLastInitial,
    companyPhone: COMPANY_PHONE,
  })

  const subject = balanceDue > 0
    ? `Invoice — Kratos Moving Quote #${quoteNumber} (Balance Due: ${moneyNum(balanceDue)})`
    : `Invoice — Kratos Moving Quote #${quoteNumber} (Paid in Full)`

  const text = `Hi ${customerFirstName}, please find your Kratos Moving invoice for Quote #${quoteNumber}. Balance due: ${balanceDue > 0 ? moneyNum(balanceDue) : '$0.00 (Paid in Full)'}. Questions? Call ${COMPANY_PHONE}.`

  return {
    ok: true,
    html,
    subject,
    text,
    customerEmail: customerRow.email,
    customerId: customerRow.id,
    customerFirstName,
  }
}

// ── GET — invoice preview (no send) ───────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const payload = await buildInvoicePayload(params.id)
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status })

  return NextResponse.json({ html: payload.html, subject: payload.subject, customerEmail: payload.customerEmail })
}

// ── POST — build + send ────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { user, role } = auth.context
  const normalizedRole = normalizeRole(role)
  if (!['owner', 'admin', 'manager', 'sales', 'dispatcher'].includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = await buildInvoicePayload(params.id)
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: payload.status })

  const admin = createAdminClient()

  try {
    await sendEmail({
      to: payload.customerEmail,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      fromName: 'Kratos Moving',
      fromEmail: process.env.EMAIL_FROM_DEFAULT ?? '',
    })

    await admin.from('communications').insert({
      opportunity_id: params.id,
      customer_id: payload.customerId,
      type: 'email',
      direction: 'outbound',
      subject: payload.subject,
      body: payload.html,
      email_to: payload.customerEmail,
      created_by: user.id,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-invoice] email failed:', err)
    const msg = err instanceof Error ? err.message : 'Failed to send invoice'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
