import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'

type CustomerRow = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
  [key: string]: unknown
}

type QuoteRow = {
  id: string
  customer_id: string
  opportunity_number: string
  status: string
  service_type: string
  company_division: string | null
  lead_source_id: string | null
  sales_agent_id: string | null
  total_amount: number
  created_at: string
  agent: { full_name: string } | null
  lead_source: { name: string } | null
  customer?: CustomerRow | null
}

type CustomerWithQuotes = CustomerRow & {
  opportunities: QuoteRow[]
  total_paid_cents: number
}

function normalizeSearch(value: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function buildCustomersFromQuotes(quotes: QuoteRow[]) {
  const customers = new Map<string, CustomerWithQuotes>()

  for (const quote of quotes) {
    if (!quote.customer?.id) continue
    const existing = customers.get(quote.customer.id)
    if (existing) {
      existing.opportunities.push(quote)
      continue
    }
    customers.set(quote.customer.id, { ...quote.customer, opportunities: [quote], total_paid_cents: 0 })
  }

  return Array.from(customers.values())
}

function mergeCustomers(customers: CustomerRow[], quoteCustomers: CustomerWithQuotes[]) {
  const byId = new Map<string, CustomerWithQuotes>()

  for (const customer of quoteCustomers) {
    byId.set(customer.id, customer)
  }

  for (const customer of customers) {
    if (byId.has(customer.id)) {
      const existing = byId.get(customer.id)
      byId.set(customer.id, {
        ...customer,
        opportunities: existing?.opportunities ?? [],
        total_paid_cents: existing?.total_paid_cents ?? 0,
      })
      continue
    }
    byId.set(customer.id, { ...customer, opportunities: [], total_paid_cents: 0 })
  }

  return Array.from(byId.values()).sort((a, b) => {
    const latestA = a.opportunities[0]?.created_at ?? a.created_at
    const latestB = b.opportunities[0]?.created_at ?? b.created_at
    return new Date(latestB).getTime() - new Date(latestA).getTime()
  })
}

function filterCustomers(customers: CustomerWithQuotes[], search: string | null) {
  const term = normalizeSearch(search)
  if (!term) return customers

  return customers.filter(customer => {
    const haystack = [
      customer.full_name,
      customer.email,
      customer.phone,
      ...customer.opportunities.map(quote => quote.opportunity_number),
    ].map(value => normalizeSearch(value)).join(' ')
    return haystack.includes(term)
  })
}

function attachPaymentTotals(customers: CustomerWithQuotes[], payments: Array<{ customer_id: string | null; amount_cents: number | null }>) {
  const totals = new Map<string, number>()
  for (const payment of payments) {
    if (!payment.customer_id) continue
    totals.set(payment.customer_id, (totals.get(payment.customer_id) ?? 0) + (payment.amount_cents ?? 0))
  }

  return customers.map(customer => ({
    ...customer,
    total_paid_cents: totals.get(customer.id) ?? 0,
  }))
}

export async function GET(req: NextRequest) {
  const authClient = createClient()
  const auth = await requireActiveProfile(authClient)
  if (auth.response) return auth.response
  const supabase = authClient

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search')
  const page     = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 25

  const { data: quoteRows, error: quoteError } = await supabase
    .from('opportunities')
    .select(`
      *,
      customer:customers!customer_id(id, full_name, email, phone, created_at),
      agent:profiles!sales_agent_id(full_name),
      lead_source:lead_sources(name)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (quoteError) {
    console.error('Customer quote source lookup error:', quoteError)
    return NextResponse.json({ error: quoteError.message }, { status: 500 })
  }

  const quoteCustomers = buildCustomersFromQuotes((quoteRows ?? []) as unknown as QuoteRow[])

  const { data: customerRows, error: customerError } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, created_at')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (customerError) {
    console.warn('Direct customer lookup failed; using quote-linked customers only:', customerError.message)
  }

  const merged = mergeCustomers((customerRows ?? []) as CustomerRow[], quoteCustomers)
  const customerIds = merged.map(customer => customer.id)
  let withPaymentTotals = merged

  if (customerIds.length) {
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('customer_id, amount_cents, status')
      .in('customer_id', customerIds)
      .eq('is_deleted', false)
      .not('status', 'in', '("failed","cancelled","canceled","refunded","void")')
      .limit(10000)

    if (paymentsError) {
      console.warn('Customer payment totals lookup failed; using zero totals:', paymentsError.message)
    } else {
      withPaymentTotals = attachPaymentTotals(
        merged,
        (payments ?? []) as Array<{ customer_id: string | null; amount_cents: number | null }>,
      )
    }
  }

  const filtered = filterCustomers(withPaymentTotals, search)
  const start = (page - 1) * pageSize
  const data = filtered.slice(start, start + pageSize)

  return NextResponse.json(
    { data, count: filtered.length, page, pageSize },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
