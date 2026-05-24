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

function normalizeSearch(value: string | null) {
  return value?.trim().toLowerCase() ?? ''
}

function buildCustomersFromQuotes(quotes: QuoteRow[]) {
  const customers = new Map<string, CustomerRow & { opportunities: QuoteRow[] }>()

  for (const quote of quotes) {
    if (!quote.customer?.id) continue
    const existing = customers.get(quote.customer.id)
    if (existing) {
      existing.opportunities.push(quote)
      continue
    }
    customers.set(quote.customer.id, { ...quote.customer, opportunities: [quote] })
  }

  return Array.from(customers.values())
}

function mergeCustomers(customers: CustomerRow[], quoteCustomers: Array<CustomerRow & { opportunities: QuoteRow[] }>) {
  const byId = new Map<string, CustomerRow & { opportunities: QuoteRow[] }>()

  for (const customer of quoteCustomers) {
    byId.set(customer.id, customer)
  }

  for (const customer of customers) {
    if (byId.has(customer.id)) {
      byId.set(customer.id, { ...customer, opportunities: byId.get(customer.id)?.opportunities ?? [] })
      continue
    }
    byId.set(customer.id, { ...customer, opportunities: [] })
  }

  return Array.from(byId.values()).sort((a, b) => {
    const latestA = a.opportunities[0]?.created_at ?? a.created_at
    const latestB = b.opportunities[0]?.created_at ?? b.created_at
    return new Date(latestB).getTime() - new Date(latestA).getTime()
  })
}

function filterCustomers(customers: Array<CustomerRow & { opportunities: QuoteRow[] }>, search: string | null) {
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
<<<<<<< HEAD
      *,
=======
      id, customer_id, opportunity_number, status, service_type, company_division,
      lead_source_id, sales_agent_id, total_amount, created_at,
>>>>>>> 8d8b47f0bfce14c7188a5b969599fbb3fa840581
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
  const filtered = filterCustomers(merged, search)
  const start = (page - 1) * pageSize
  const data = filtered.slice(start, start + pageSize)

  return NextResponse.json(
    { data, count: filtered.length, page, pageSize },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
