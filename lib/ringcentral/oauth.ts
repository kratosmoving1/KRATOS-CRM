import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'

const TOKEN_ENDPOINT = '/restapi/oauth/token'

type RingCentralTokenResponse = {
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  refresh_token_expires_in?: number
  scope?: string
  owner_id?: string
  endpoint_id?: string
  error?: string
  error_description?: string
}

type RingCentralPhoneNumber = {
  id?: string
  phoneNumber?: string
  type?: string
  usageType?: string
  features?: string[]
}

export type RingCentralUserConnection = {
  accessToken: string
  callFromNumber: string
  smsFromNumber: string
  extensionId: string | null
  extensionNumber: string | null
  displayName: string | null
}

export function getRingCentralServerUrl() {
  return process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com'
}

export function getRingCentralRedirectUri() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'http://localhost:3000'
  const origin = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`
  return `${origin.replace(/\/$/, '')}/api/ringcentral/oauth/callback`
}

function getCredentials() {
  const clientId = process.env.RINGCENTRAL_CLIENT_ID
  const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('RingCentral OAuth is not configured.')
  return {
    clientId,
    authHeader: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
  }
}

function parseProviderError(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  const record = data as Record<string, unknown>
  return String(record.error_description || record.message || record.error || fallback)
}

async function tokenRequest(body: URLSearchParams) {
  const { authHeader } = getCredentials()
  const res = await fetch(`${getRingCentralServerUrl()}${TOKEN_ENDPOINT}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = (await res.json().catch(() => ({}))) as RingCentralTokenResponse
  if (!res.ok || !data.access_token) {
    throw new Error(parseProviderError(data, 'Unable to authenticate with RingCentral.'))
  }
  return data
}

export function getRingCentralAuthorizationUrl(state: string) {
  const { clientId } = getCredentials()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getRingCentralRedirectUri(),
    state,
    prompt: 'login',
  })
  return `${getRingCentralServerUrl()}/restapi/oauth/authorize?${params.toString()}`
}

export function exchangeRingCentralCode(code: string) {
  return tokenRequest(new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRingCentralRedirectUri(),
  }))
}

async function refreshRingCentralToken(refreshToken: string) {
  return tokenRequest(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }))
}

async function ringCentralGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${getRingCentralServerUrl()}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(parseProviderError(data, 'Unable to read RingCentral account.'))
  return data as T
}

function selectNumber(records: RingCentralPhoneNumber[], feature: 'CallerId' | 'SmsSender') {
  const matched = records.find(record => record.features?.includes(feature) && normalizePhoneToE164(record.phoneNumber ?? '').isE164)
  return normalizePhoneToE164(matched?.phoneNumber ?? '').normalized
}

export async function saveRingCentralConnection(userId: string, token: RingCentralTokenResponse) {
  if (!token.access_token || !token.refresh_token) throw new Error('RingCentral did not return usable tokens.')

  const extension = await ringCentralGet<Record<string, unknown>>(token.access_token, '/restapi/v1.0/account/~/extension/~')
  const phones = await ringCentralGet<{ records?: RingCentralPhoneNumber[] }>(token.access_token, '/restapi/v1.0/account/~/extension/~/phone-number')
  const records = phones.records ?? []
  const callFromNumber = selectNumber(records, 'CallerId') || selectNumber(records, 'SmsSender')
  const smsFromNumber = selectNumber(records, 'SmsSender') || callFromNumber

  if (!callFromNumber && !smsFromNumber) {
    throw new Error('No callable or SMS-capable RingCentral number was found on this user extension.')
  }

  const now = Date.now()
  const admin = createAdminClient()
  const { error } = await admin.from('ringcentral_user_connections').upsert({
    user_id: userId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type ?? 'bearer',
    scope: token.scope ?? null,
    owner_id: token.owner_id ?? null,
    extension_id: extension.id ? String(extension.id) : null,
    extension_number: extension.extensionNumber ? String(extension.extensionNumber) : null,
    display_name: extension.name ? String(extension.name) : null,
    call_from_number: callFromNumber || null,
    sms_from_number: smsFromNumber || null,
    expires_at: new Date(now + ((token.expires_in ?? 3600) - 60) * 1000).toISOString(),
    refresh_expires_at: token.refresh_token_expires_in
      ? new Date(now + token.refresh_token_expires_in * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(error.message)
}

export async function getRingCentralUserConnection(userId: string): Promise<RingCentralUserConnection | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ringcentral_user_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01') throw new Error('RingCentral user connection table is missing. Run the Supabase setup SQL.')
    throw new Error(error.message)
  }
  if (!data) return null

  let row = data as Record<string, string | null>
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
  if (expiresAt <= Date.now() + 60_000) {
    if (!row.refresh_token) return null
    const refreshed = await refreshRingCentralToken(row.refresh_token)
    await saveRingCentralConnection(userId, refreshed)
    const again = await admin
      .from('ringcentral_user_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (again.error) throw new Error(again.error.message)
    row = again.data as Record<string, string | null>
  }

  const accessToken = row.access_token
  const callFromNumber = row.call_from_number
  const smsFromNumber = row.sms_from_number || row.call_from_number
  if (!accessToken || !callFromNumber) return null

  return {
    accessToken,
    callFromNumber,
    smsFromNumber: smsFromNumber ?? callFromNumber,
    extensionId: row.extension_id ?? null,
    extensionNumber: row.extension_number ?? null,
    displayName: row.display_name ?? null,
  }
}

export async function getRingCentralConnectionSummary(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ringcentral_user_connections')
    .select('extension_id, extension_number, display_name, call_from_number, sms_from_number, expires_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return {
      connected: false,
      setupRequired: error.code === '42P01',
      message: error.code === '42P01' ? 'RingCentral user connection table is missing.' : error.message,
    }
  }
  if (!data) {
    return {
      connected: false,
      setupRequired: false,
      message: 'Connect your RingCentral account to place calls and send SMS from CRM.',
    }
  }
  return {
    connected: true,
    setupRequired: false,
    message: 'RingCentral user account connected.',
    ...data,
  }
}
