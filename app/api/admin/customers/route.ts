import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    .select(`
      *,
      opportunities!customer_id(
        id, opportunity_number, status, service_type, company_division, lead_source_id,
        sales_agent_id, total_amount, created_at,
        agent:profiles!sales_agent_id(full_name),
        lead_source:lead_sources(name)
      )
    `, { count: 'exact' })
    .eq('is_deleted', false)

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Customers GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count, page, pageSize })
}
