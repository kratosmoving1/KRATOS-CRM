/**
 * Merge field interpolation engine for document templates.
 * Replaces {{token}} placeholders in HTML with real opportunity data.
 */

import { formatRate } from '@/lib/charges/format'
import type { OpportunityCharge } from '@/components/admin/charges/types'
import { KRATOS_COMPANY } from '@/lib/constants/company'

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPANY = KRATOS_COMPANY

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RenderContext {
  opportunity_id: string
  opportunity_number: string
  service_date: string | null
  move_size: string | null
  service_type: string | null
  deposit_amount: number | null
  customer: {
    full_name: string
    email: string | null
    phone: string | null
  } | null
  agent: {
    full_name: string
    email: string
  } | null
  lead_source: { name: string } | null
  origin_address_line1: string | null
  origin_address_line2: string | null
  origin_city: string | null
  origin_province: string | null
  origin_postal_code: string | null
  origin_dwelling_type: string | null
  dest_address_line1: string | null
  dest_address_line2: string | null
  dest_city: string | null
  dest_province: string | null
  dest_postal_code: string | null
  dest_dwelling_type: string | null
  charges: OpportunityCharge[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function fmtDate(d: string | null): string {
  if (!d) return 'TBD'
  const [year, month, day] = d.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-CA', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function buildChargesTable(charges: OpportunityCharge[]): string {
  if (!charges.length) return '<p><em>No charges added yet.</em></p>'

  const subtotal = charges.reduce((s, c) => s + c.subtotal, 0)
  const discounts = charges.reduce((s, c) => s + c.discount_amount, 0)
  const total = charges.reduce((s, c) => s + c.total, 0)
  const hst = +(total * 0.13).toFixed(2)
  const grandTotal = +(total + hst).toFixed(2)

  const rows = charges.map(c => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e2e8f0">${c.name}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:0.85em;color:#64748b">${formatRate(c)}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right">${fmt(c.subtotal)}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right">${c.discount_amount > 0 ? `−${fmt(c.discount_amount)}` : '—'}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:600">${fmt(c.total)}</td>
    </tr>`).join('')

  return `
<table style="width:100%;border-collapse:collapse;font-size:0.9em;margin:8px 0">
  <thead>
    <tr style="background:#f8fafc">
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Description</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Rate / Detail</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:right">Subtotal</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:right">Discount</th>
      <th style="padding:8px;border:1px solid #e2e8f0;text-align:right">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr style="background:#f8fafc;font-weight:600">
      <td colspan="4" style="padding:8px;border:1px solid #e2e8f0">Subtotal</td>
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${fmt(subtotal)}</td>
    </tr>
    ${discounts > 0 ? `<tr><td colspan="4" style="padding:8px;border:1px solid #e2e8f0">Discounts</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:right">−${fmt(discounts)}</td></tr>` : ''}
    <tr>
      <td colspan="4" style="padding:8px;border:1px solid #e2e8f0">HST (13%)</td>
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${fmt(hst)}</td>
    </tr>
    <tr style="background:#0f172a;color:#fff;font-weight:700">
      <td colspan="4" style="padding:8px;border:1px solid #1e293b">Estimated Total</td>
      <td style="padding:8px;border:1px solid #1e293b;text-align:right">${fmt(grandTotal)}</td>
    </tr>
  </tfoot>
</table>`
}

function buildMovingLaborInfo(charges: OpportunityCharge[]) {
  const labor = charges.find(c => c.charge_type === 'moving_labor')
  if (!labor) return { package_name: '—', num_trucks: '—', num_crew: '—', hourly_rate: '—', labor_hours: '—', minimum_hours: '—' }
  const c = labor.config
  return {
    package_name: String(c.package_name ?? 'Moving Labor'),
    num_trucks: String(c.num_trucks ?? 0),
    num_crew: String(c.num_crew ?? 0),
    hourly_rate: c.hourly_rate ? `$${Number(c.hourly_rate).toFixed(2)}/hr` : '—',
    labor_hours: c.labor_hours ? `${c.labor_hours}h` : '—',
    minimum_hours: c.minimum_hours ? `${c.minimum_hours}h` : '—',
  }
}

// ── Build the token → value map ───────────────────────────────────────────────

function buildTokenMap(ctx: RenderContext, docNumber: string): Record<string, string> {
  const customer = ctx.customer
  const agent = ctx.agent
  const charges = ctx.charges

  const subtotal = charges.reduce((s, c) => s + c.total, 0)
  const hst = +(subtotal * 0.13).toFixed(2)
  const estimatedTotal = +(subtotal + hst).toFixed(2)
  const deposit = ctx.deposit_amount ?? 150
  const balanceDue = Math.max(0, estimatedTotal - deposit)

  const originParts = [ctx.origin_address_line1, ctx.origin_city, ctx.origin_province].filter(Boolean)
  const destParts = [ctx.dest_address_line1, ctx.dest_city, ctx.dest_province].filter(Boolean)

  const firstName = (customer?.full_name ?? '').split(' ')[0] || '—'
  const lastName = (customer?.full_name ?? '').split(' ').slice(1).join(' ') || '—'
  const agentFirst = (agent?.full_name ?? '').split(' ')[0] || '—'

  const labor = buildMovingLaborInfo(charges)
  const moveSizeLabel = ctx.move_size
    ? ctx.move_size.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '—'
  const serviceTypeLabel = ctx.service_type
    ? ctx.service_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '—'

  return {
    // Customer
    customer_first_name: firstName,
    customer_last_name: lastName,
    customer_full_name: customer?.full_name ?? '—',
    customer_phone: customer?.phone ?? '—',
    customer_email: customer?.email ?? '—',
    // Opportunity
    quote_number: ctx.opportunity_number ?? '—',
    move_date: fmtDate(ctx.service_date),
    move_size: moveSizeLabel,
    service_type: serviceTypeLabel,
    lead_source: ctx.lead_source?.name ?? '—',
    // Addresses
    origin_address: originParts.join(', ') || '—',
    origin_city: ctx.origin_city ?? '—',
    origin_dwelling_type: ctx.origin_dwelling_type?.replace(/_/g, ' ') ?? '—',
    destination_address: destParts.join(', ') || '—',
    destination_city: ctx.dest_city ?? '—',
    destination_dwelling_type: ctx.dest_dwelling_type?.replace(/_/g, ' ') ?? '—',
    // Package
    package_name: labor.package_name,
    num_trucks: labor.num_trucks,
    num_crew: labor.num_crew,
    hourly_rate: labor.hourly_rate,
    labor_hours: labor.labor_hours,
    minimum_hours: labor.minimum_hours,
    // Charges
    charges_table: buildChargesTable(charges),
    subtotal: fmt(subtotal),
    hst: fmt(hst),
    estimated_total: fmt(estimatedTotal),
    deposit_required: fmt(deposit),
    balance_due: fmt(balanceDue),
    // Agent
    agent_first_name: agentFirst,
    agent_full_name: agent?.full_name ?? '—',
    agent_email: agent?.email ?? '—',
    // Company
    company_name: COMPANY.name,
    company_phone: COMPANY.phone,
    company_email: COMPANY.email,
    company_address: COMPANY.address,
    company_website: COMPANY.website,
    company_slogan: COMPANY.slogan,
    // Document
    generated_date: new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }),
    document_number: docNumber,
    signature_block: '<div style="margin-top:32px;border-top:1px solid #334155;padding-top:8px;color:#64748b;font-size:0.85em">Customer Signature _________________________ &nbsp; Date _____________</div>',
  }
}

// ── Main render function ──────────────────────────────────────────────────────

export function renderDocument(
  contentHtml: string,
  ctx: RenderContext,
  docNumber: string,
): string {
  const tokens = buildTokenMap(ctx, docNumber)
  return contentHtml.replace(/\{\{([a-z_]+)\}\}/g, (_, token) => {
    return tokens[token] ?? `{{${token}}}`
  })
}

export function buildDocumentNumber(quoteNumber: string, category: string): string {
  const categoryCode = category.replace(/^(opportunity_|job_)/, '').toUpperCase().slice(0, 3)
  return `DOC-${quoteNumber}-${categoryCode}`
}
