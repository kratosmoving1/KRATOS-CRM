import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DashboardData } from '@/lib/queries/dashboard'

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('get_dashboard_data')

  if (error) {
    console.error('Dashboard RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as DashboardData)
}
