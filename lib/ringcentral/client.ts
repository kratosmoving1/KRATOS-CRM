import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'

const RC_CLIENT_ID = process.env.RINGCENTRAL_CLIENT_ID
const RC_CLIENT_SECRET = process.env.RINGCENTRAL_CLIENT_SECRET
const RC_JWT = process.env.RINGCENTRAL_JWT
const RC_SERVER = process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com'
const RC_FROM = process.env.RINGCENTRAL_FROM_NUMBER
const RINGOUT_ENDPOINT = '/restapi/v1.0/account/~/extension/~/ring-out'
const TOKEN_ENDPOINT = '/restapi/oauth/token'

type RingCentralTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type RingCentralErrorResponse = {
  message?: string
  error?: string
  errorCode?: string
  error_description?: string
  errors?: Array<{ message?: string; errorCode?: string }>
}

type StartRingCentralCallInput = {
  to: string
  from?: string
}

type SendRingCentralSmsInput = {
  to: string
  from: string
  text: string
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

type SendRingCentralSmsResult = {
  id?: string
  uri?: string
  messageStatus?: string
  raw: unknown
}

export class RingCentralCallError extends Error {
  status?: number
  code?: string
  details?: unknown

  constructor(message: string, options: { status?: number; code?: string; details?: unknown } = {}) {
    super(message)
    this.name = 'RingCentralCallError'
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}

export function isRingCentralConfigured() {
  return Boolean(RC_CLIENT_ID && RC_CLIENT_SECRET && RC_JWT && RC_FROM)
}

export function getRingCentralConfigStatus() {
  return {
    hasClientId: Boolean(RC_CLIENT_ID),
    hasClientSecret: Boolean(RC_CLIENT_SECRET),
    hasJwt: Boolean(RC_JWT),
    hasServerUrl: Boolean(RC_SERVER),
    hasFromNumber: Boolean(RC_FROM),
    serverUrl: RC_SERVER,
  }
}

function ringCentralLog(message: string, metadata?: Record<string, unknown>) {
  console.info(`[RingCentral] ${message}`, metadata ?? {})
}

function extractRingCentralError(data: RingCentralErrorResponse, fallback: string) {
  return (
    data.message ||
    data.error_description ||
    data.error ||
    data.errors?.find(error => error.message)?.message ||
    fallback
  )
}

async function getAccessToken() {
  if (!isRingCentralConfigured()) throw new Error('RingCentral is not configured.')

  const credentials = Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: RC_JWT as string,
  })

  ringCentralLog('Authenticating with JWT', {
    endpoint: `${RC_SERVER}${TOKEN_ENDPOINT}`,
    config: getRingCentralConfigStatus(),
  })

  const res = await fetch(`${RC_SERVER}${TOKEN_ENDPOINT}`, {
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
    console.error('[RingCentral] Auth failed', {
      status: res.status,
      code: data.error,
      message,
    })
    throw new RingCentralCallError(message, { status: res.status, code: data.error, details: data })
  }

  ringCentralLog('Auth succeeded', {
    status: res.status,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  })

  return data.access_token
}

export async function startRingCentralCall({ to, from = RC_FROM }: StartRingCentralCallInput): Promise<StartRingCentralCallResult> {
  if (!isRingCentralConfigured() || !from) throw new Error('RingCentral is not configured.')

  const normalizedTo = normalizePhoneToE164(to)
  const normalizedFrom = normalizePhoneToE164(from)

  if (!normalizedTo.isE164) {
    throw new RingCentralCallError(`Invalid customer phone number: ${to}`, { code: 'INVALID_TO_NUMBER' })
  }

  if (!normalizedFrom.isE164) {
    throw new RingCentralCallError(`Invalid RingCentral from number: ${from}`, { code: 'INVALID_FROM_NUMBER' })
  }

  const token = await getAccessToken()
  const endpoint = `${RC_SERVER}${RINGOUT_ENDPOINT}`
  const requestBody = {
    from: { phoneNumber: normalizedFrom.normalized },
    to: { phoneNumber: normalizedTo.normalized },
    playPrompt: true,
  }

  ringCentralLog('Starting RingOut call', {
    endpoint,
    from: normalizedFrom.normalized,
    to: normalizedTo.normalized,
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorObject = data as RingCentralErrorResponse
    const message = extractRingCentralError(errorObject, 'Unable to start RingCentral call.')
    console.error('[RingCentral] RingOut failed', {
      status: res.status,
      code: errorObject.errorCode || errorObject.error,
      message,
      endpoint,
      from: normalizedFrom.normalized,
      to: normalizedTo.normalized,
    })
    throw new RingCentralCallError(message, {
      status: res.status,
      code: errorObject.errorCode || errorObject.error,
      details: data,
    })
  }

  ringCentralLog('RingOut response received', {
    status: res.status,
    responseStatus: (data as StartRingCentralCallResult).status,
  })

  const result = data as Omit<StartRingCentralCallResult, 'raw'>
  return {
    id: result.id,
    uri: result.uri,
    status: result.status,
    raw: data,
  }
}

export async function sendSmsViaRingCentral({ to, from, text }: SendRingCentralSmsInput): Promise<SendRingCentralSmsResult> {
  if (!isRingCentralConfigured()) throw new Error('RingCentral is not configured.')

  const normalizedTo = normalizePhoneToE164(to)
  const normalizedFrom = normalizePhoneToE164(from)

  if (!normalizedTo.isE164) {
    throw new RingCentralCallError(`Invalid SMS recipient phone number: ${to}`, { code: 'INVALID_SMS_TO_NUMBER' })
  }

  if (!normalizedFrom.isE164) {
    throw new RingCentralCallError(`Invalid RingCentral SMS from number: ${from}`, { code: 'INVALID_SMS_FROM_NUMBER' })
  }

  const token = await getAccessToken()
  const endpoint = `${RC_SERVER}/restapi/v1.0/account/~/extension/~/sms`

  ringCentralLog('Sending SMS', {
    endpoint,
    from: normalizedFrom.normalized,
    to: normalizedTo.normalized,
  })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { phoneNumber: normalizedFrom.normalized },
      to: [{ phoneNumber: normalizedTo.normalized }],
      text,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorObject = data as RingCentralErrorResponse
    const message = extractRingCentralError(errorObject, 'Unable to send RingCentral SMS.')
    console.error('[RingCentral] SMS failed', {
      status: res.status,
      code: errorObject.errorCode || errorObject.error,
      message,
      endpoint,
      from: normalizedFrom.normalized,
      to: normalizedTo.normalized,
    })
    throw new RingCentralCallError(message, {
      status: res.status,
      code: errorObject.errorCode || errorObject.error,
      details: data,
    })
  }

  ringCentralLog('SMS response received', {
    status: res.status,
    messageStatus: (data as SendRingCentralSmsResult).messageStatus,
  })

  const result = data as Omit<SendRingCentralSmsResult, 'raw'>
  return {
    id: result.id,
    uri: result.uri,
    messageStatus: result.messageStatus,
    raw: data,
  }
}

export async function renderTemplate(body: string, vars: Record<string,string|undefined>) {
  let out = body
  Object.entries(vars).forEach(([k,v]) => {
    const re = new RegExp(`{{\\s*${k}\\s*}}`, 'g')
    out = out.replace(re, v ?? '')
  })
  return out
}
