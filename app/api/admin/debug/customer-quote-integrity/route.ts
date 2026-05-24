import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isActiveUser, normalizeRole } from '@/lib/auth/permissions'
import { normalizeEmail, normalizePhone } from '@/lib/customers/matching'

type CustomerRow = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
}

type QuoteRow = {
  id: string
  opportunity_number: string | null
  customer_id: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  customer?: CustomerRow | null
}

function groupDuplicates(customers: CustomerRow[], field: 'phone' | 'email') {
  const groups = new Map<string, CustomerRow[]>()

  for (const customer of customers) {
    const key = field === 'phone' ? normalizePhone(customer.phone) : normalizeEmail(customer.email)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(customer)
    groups.set(key, list)
  }

  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([value, rows]) => ({
      [field]: value,
      count: rows.length,
      canonicalCustomerId: rows[0].id,
      customerIds: rows.map(row => row.id),
    }))
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (!isActiveUser(profile) || !['owner', 'admin', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ count: customersCount, error: customersCountError }, { count: quotesCount, error: quotesCountError }] =
    await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    ])

  if (customersCountError) return NextResponse.json({ error: customersCountError.message }, { status: 500 })
  if (quotesCountError) return NextResponse.json({ error: quotesCountError.message }, { status: 500 })

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, created_at')
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(10000)

  if (customersError) return NextResponse.json({ error: customersError.message }, { status: 500 })

  const { data: quotes, error: quotesError } = await supabase
    .from('opportunities')
    .select(`
      *,
      customer:customers!customer_id(id, full_name, email, phone, created_at)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (quotesError) return NextResponse.json({ error: quotesError.message }, { status: 500 })

  const customerRows = (customers ?? []) as CustomerRow[]
  const quoteRows = (quotes ?? []) as unknown as QuoteRow[]
  const customerIds = new Set(customerRows.map(customer => customer.id))

  const brokenQuotes = quoteRows.filter(quote => !quote.customer_id || !customerIds.has(quote.customer_id))

  return NextResponse.json({
    customersCount: customersCount ?? customerRows.length,
    quotesCount: quotesCount ?? quoteRows.length,
    quotesWithoutCustomerId: quoteRows.filter(quote => !quote.customer_id).length,
    quotesWithMissingCustomerRecord: quoteRows.filter(quote => quote.customer_id && !customerIds.has(quote.customer_id)).length,
    duplicateCustomersByPhone: groupDuplicates(customerRows, 'phone'),
    duplicateCustomersByEmail: groupDuplicates(customerRows, 'email'),
    sampleBrokenQuotes: brokenQuotes.slice(0, 25).map(quote => ({
      quoteId: quote.id,
      quoteNumber: quote.opportunity_number,
      displayedCustomerName: quote.customer?.full_name ?? quote.customer_name ?? null,
      customerId: quote.customer_id,
      customerRecordExists: Boolean(quote.customer_id && customerIds.has(quote.customer_id)),
      customerEmail: quote.customer?.email ?? quote.customer_email ?? null,
      customerPhone: quote.customer?.phone ?? quote.customer_phone ?? null,
    })),
  })
}
