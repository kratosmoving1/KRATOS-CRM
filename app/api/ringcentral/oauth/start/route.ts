import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { getRingCentralAuthorizationUrl } from '@/lib/ringcentral/oauth'

export async function GET() {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  try {
    const state = randomUUID()
    cookies().set('ringcentral_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 10 * 60,
      path: '/',
    })
    return NextResponse.redirect(getRingCentralAuthorizationUrl(state))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to start RingCentral login.' },
      { status: 500 },
    )
  }
}
