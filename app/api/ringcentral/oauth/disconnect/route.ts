import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireActiveProfile } from '@/lib/auth/server'

export async function POST() {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const admin = createAdminClient()
  const { error } = await admin
    .from('ringcentral_user_connections')
    .delete()
    .eq('user_id', auth.context.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42P01' ? 424 : 500 })
  return NextResponse.json({ ok: true })
}
