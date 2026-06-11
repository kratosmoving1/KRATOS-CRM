import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { data, error } = await supabase
    .from('payments')
    .select('id, method, status, amount_cents, payment_date, reference_number, notes, created_at, provider')
    .eq('opportunity_id', params.id)
    .not('is_deleted', 'is', true)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[OpportunityPayments] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
