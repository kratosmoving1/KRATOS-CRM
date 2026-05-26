import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { getRingCentralAuthorizationUrl, getRingCentralConnectionSummary } from '@/lib/ringcentral/oauth'

export async function GET(req: Request) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  try {
    const summary = await getRingCentralConnectionSummary(auth.context.user.id)
    if (summary.setupRequired) {
      return redirectWithStatus(req, 'error', 'RingCentral setup is not complete. Run the Supabase setup SQL first, then connect RingCentral.')
    }

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
    return redirectWithStatus(req, 'error', err instanceof Error ? err.message : 'Unable to start RingCentral login.')
  }
}

function redirectWithStatus(req: Request, status: string, message: string) {
  const url = new URL('/admin/settings/integrations', req.url)
  url.searchParams.set('ringcentral', status)
  url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}
