import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { syncTravelCharge } from '@/lib/charges/syncTravelCharge'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { data: opp } = await supabase
    .from('opportunities')
    .select(`
      id,
      dest_address_line1, dest_address_line2,
      dest_city, dest_province, dest_postal_code
    `)
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (!opp) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const result = await syncTravelCharge(supabase, opp)
  return NextResponse.json({ ok: true, travel: result })
}
