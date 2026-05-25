import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { exchangeRingCentralCode, saveRingCentralConnection } from '@/lib/ringcentral/oauth'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expectedState = cookies().get('ringcentral_oauth_state')?.value
  cookies().delete('ringcentral_oauth_state')

  if (!code) {
    return redirectWithStatus(req, 'error', url.searchParams.get('error_description') || 'RingCentral did not return an authorization code.')
  }
  if (!state || !expectedState || state !== expectedState) {
    return redirectWithStatus(req, 'error', 'RingCentral login state did not match. Please try connecting again.')
  }

  try {
    const token = await exchangeRingCentralCode(code)
    await saveRingCentralConnection(auth.context.user.id, token)
    return redirectWithStatus(req, 'connected', 'RingCentral connected.')
  } catch (err) {
    return redirectWithStatus(req, 'error', err instanceof Error ? err.message : 'Unable to connect RingCentral.')
  }
}

function redirectWithStatus(req: NextRequest, status: string, message: string) {
  const redirectUrl = new URL('/admin/settings/integrations', req.url)
  redirectUrl.searchParams.set('ringcentral', status)
  redirectUrl.searchParams.set('message', message)
  return NextResponse.redirect(redirectUrl)
}
