import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { getSmsDeliveryStatus } from '@/lib/sms/provider'

export async function GET() {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const status = getSmsDeliveryStatus()
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}
