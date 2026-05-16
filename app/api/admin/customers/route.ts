import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
}

function dedupeCustomers(customers: CustomerRow[], quotes: QuoteRow[]) {
  const byCustomerId = new Map<string, QuoteRow[]>()
  for (const quote of quotes) {
    const list = byCustomerId.get(quote.customer_id) ?? []
    list.push(quote)
    byCustomerId.set(quote.customer_id, list)
  }

  const seen = new Map<string, CustomerRow & { opportunities: QuoteRow[] }>()
  for (const customer of customers) {
    const key = (customer.email ?? customer.phone ?? customer.full_name).trim().toLowerCase()
    const existing = seen.get(key)
    const customerQuotes = byCustomerId.get(customer.id) ?? []
    if (existing) {
      existing.opportunities.push(...customerQuotes)
      continue
    }
    seen.set(key, { ...customer, opportunities: customerQuotes })
  }

  return Array.from(seen.values())
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search')
  const page     = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 25

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('is_deleted', false)

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data: customers, error, count } = await query

  if (error) {
    console.error('Customers GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const customerIds = (customers ?? []).map(customer => customer.id)
  let quotes: QuoteRow[] = []

  if (customerIds.length) {
    const { data: quoteRows, error: quoteError } = await supabase
      .from('opportunities')
      .select(`
        id, customer_id, opportunity_number, status, service_type, company_division,
        lead_source_id, sales_agent_id, total_amount, created_at,
        agent:profiles!sales_agent_id(full_name),
        lead_source:lead_sources(name)
      `)
      .in('customer_id', customerIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (quoteError) {
      console.error('Customer quotes lookup error:', quoteError)
      return NextResponse.json({ error: quoteError.message }, { status: 500 })
    }

    quotes = (quoteRows ?? []) as unknown as QuoteRow[]
  }

  const data = dedupeCustomers((customers ?? []) as CustomerRow[], quotes)

  return NextResponse.json({ data, count: count ?? data.length, page, pageSize })
}
