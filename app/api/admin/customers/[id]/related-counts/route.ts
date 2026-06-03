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

  const [opps, comms] = await Promise.all([
    supabase
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', params.id)
      .neq('is_deleted', true),
    supabase
      .from('communications')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', params.id)
      .neq('is_deleted', true),
  ])

  return NextResponse.json({
    quotes:         opps.count  ?? 0,
    communications: comms.count ?? 0,
  })
}
