/**
 * Minimal RingCentral client skeleton.
 * - Does not hardcode credentials
 * - Reads configuration from environment variables
 * - Uses REST endpoints server-side only
 */

const RC_CLIENT_ID = process.env.RINGCENTRAL_CLIENT_ID
const RC_CLIENT_SECRET = process.env.RINGCENTRAL_CLIENT_SECRET
const RC_JWT = process.env.RINGCENTRAL_JWT
const RC_SERVER = process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com'
const RC_FROM = process.env.RINGCENTRAL_FROM_NUMBER

type RingCentralTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type StartRingCentralCallInput = {
  to: string
  from?: string
}

export type StartRingCentralCallResult = {
  id?: string
  uri?: string
  status?: {
    callStatus?: string
    callerStatus?: string
    calleeStatus?: string
  }
  raw: unknown
}

export function isRingCentralConfigured() {
  return Boolean(RC_CLIENT_ID && RC_CLIENT_SECRET && RC_JWT && RC_FROM)
}

export function normalizePhoneToE164(value: string) {
  const withoutExtension = value.replace(/(?:ext\.?|x)\s*\d+$/i, '').trim()
  const digits = withoutExtension.replace(/\D/g, '')

  if (withoutExtension.startsWith('+') && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`
  }

  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`

  return value.trim()
}

async function getAccessToken() {
  if (!isRingCentralConfigured()) throw new Error('RingCentral is not configured.')

  const credentials = Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: RC_JWT as string,
  })

  const res = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = (await res.json().catch(() => ({}))) as RingCentralTokenResponse

  if (!res.ok || !data.access_token) {
    const message = data.error_description || data.error || 'Unable to authenticate with RingCentral.'
    throw new Error(message)
  }

  return data.access_token
}

export async function startRingCentralCall({ to, from = RC_FROM }: StartRingCentralCallInput): Promise<StartRingCentralCallResult> {
  if (!isRingCentralConfigured() || !from) throw new Error('RingCentral is not configured.')

  const token = await getAccessToken()
  const res = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/ring-out`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { phoneNumber: from },
      to: { phoneNumber: to },
      callerId: { phoneNumber: from },
      playPrompt: true,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorObject = data as { message?: string; errorCode?: string }
    throw new Error(errorObject.message || errorObject.errorCode || 'Unable to start RingCentral call.')
  }

  const result = data as Omit<StartRingCentralCallResult, 'raw'>
  return {
    id: result.id,
    uri: result.uri,
    status: result.status,
    raw: data,
  }
}

export async function sendSmsViaRingCentral({ to, from, text }: { to: string; from: string; text: string }) {
  if (!isRingCentralConfigured()) throw new Error('RingCentral is not configured.')
  // Placeholder: implement using official SDK when available.
  // Example flow:
  // 1. Create SDK client with client id/secret and server
  // 2. Authenticate using JWT or OAuth
  // 3. Call POST /restapi/v1.0/account/~/extension/~/sms
  // 4. Return API result
  throw new Error('sendSmsViaRingCentral not implemented — install RingCentral SDK and implement')
}

export async function renderTemplate(body: string, vars: Record<string,string|undefined>) {
  let out = body
  Object.entries(vars).forEach(([k,v]) => {
    const re = new RegExp(`{{\\s*${k}\\s*}}`, 'g')
    out = out.replace(re, v ?? '')
  })
  return out
}
