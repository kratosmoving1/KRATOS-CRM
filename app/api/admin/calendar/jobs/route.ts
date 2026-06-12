import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'

const JOB_STATUSES = ['booked', 'completed', 'opportunity'] as const

function isDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: 'Valid start and end dates are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      customer:customers!customer_id(id, full_name, phone, email),
      agent:profiles!sales_agent_id(id, full_name)
    `)
    .eq('is_deleted', false)
    .not('service_date', 'is', null)
    .gte('service_date', start)
    .lte('service_date', end)
    .in('status', [...JOB_STATUSES])
    .order('service_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Calendar jobs lookup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { data: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
