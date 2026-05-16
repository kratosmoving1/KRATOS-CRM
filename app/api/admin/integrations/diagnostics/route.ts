import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'

type EnvStatus = {
  present: boolean
  value?: string
  note?: string
}

type RingCentralTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

type RingCentralPhoneNumber = {
  id?: string
  phoneNumber?: string
  type?: string
  features?: string[]
  usageType?: string
}

const SAFE_ENV_VALUES = new Set([
  'NEXT_PUBLIC_APP_URL',
  'EMAIL_PROVIDER',
  'EMAIL_FROM_DEFAULT',
  'EMAIL_REPLY_TO_DEFAULT',
  'RINGCENTRAL_SERVER_URL',
  'RINGCENTRAL_FROM_NUMBER',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
])

const ENV_GROUP = [
  'NEXT_PUBLIC_APP_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'EMAIL_FROM_DEFAULT',
  'EMAIL_REPLY_TO_DEFAULT',
  'RINGCENTRAL_CLIENT_ID',
  'RINGCENTRAL_CLIENT_SECRET',
  'RINGCENTRAL_JWT',
  'RINGCENTRAL_SERVER_URL',
  'RINGCENTRAL_FROM_NUMBER',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const

const RC_REQUIRED = [
  'RINGCENTRAL_CLIENT_ID',
  'RINGCENTRAL_CLIENT_SECRET',
  'RINGCENTRAL_JWT',
  'RINGCENTRAL_SERVER_URL',
  'RINGCENTRAL_FROM_NUMBER',
] as const

function envStatus(name: string): EnvStatus {
  const value = process.env[name]
  if (!value) return { present: false }
  if (SAFE_ENV_VALUES.has(name)) return { present: true, value }
  return { present: true }
}

function getEnvironment() {
  return Object.fromEntries(ENV_GROUP.map(name => [name, envStatus(name)]))
}

function missing(names: readonly string[]) {
  return names.filter(name => !process.env[name])
}

function parseProviderError(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') return fallback
  const record = data as Record<string, unknown>
  const errors = Array.isArray(record.errors) ? record.errors : []
  const firstError = errors.find(error => error && typeof error === 'object') as Record<string, unknown> | undefined
  return String(record.message || record.error_description || record.error || firstError?.message || fallback)
}

async function ringCentralDiagnostics() {
  const serverUrl = process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com'
  const fromNumber = process.env.RINGCENTRAL_FROM_NUMBER || ''
  const missingEnv = missing(RC_REQUIRED)

  const base = {
    configured: missingEnv.length === 0,
    authStatus: missingEnv.length === 0 ? 'error' : 'not_configured',
    message: missingEnv.length ? `RingCentral is not configured. Missing: ${missingEnv.join(', ')}.` : 'RingCentral diagnostics not completed.',
    serverUrl,
    authenticatedExtension: null as null | {
      id?: string
      extensionNumber?: string
      name?: string
      email?: string
    },
    scopes: [] as string[],
    phoneNumbers: [] as Array<{
      phoneNumber: string
      type: string
      features: string[]
    }>,
    fromNumber: {
      value: fromNumber,
      ownedByAuthenticatedExtension: false,
      smsCapable: false,
      callCapable: false,
    },
  }

  if (missingEnv.length) return base

  const credentials = Buffer.from(`${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: process.env.RINGCENTRAL_JWT as string,
  })

  try {
    const tokenRes = await fetch(`${serverUrl}/restapi/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const tokenData = (await tokenRes.json().catch(() => ({}))) as RingCentralTokenResponse
    if (!tokenRes.ok || !tokenData.access_token) {
      return {
        ...base,
        authStatus: 'error',
        message: `RingCentral JWT auth failed: ${parseProviderError(tokenData, 'Unable to authenticate with RingCentral.')}`,
      }
    }

    const scopes = tokenData.scope ? tokenData.scope.split(/\s+/).filter(Boolean) : []
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${tokenData.access_token}`,
    }

    const [extensionRes, phoneRes] = await Promise.all([
      fetch(`${serverUrl}/restapi/v1.0/account/~/extension/~`, { headers }),
      fetch(`${serverUrl}/restapi/v1.0/account/~/extension/~/phone-number`, { headers }),
    ])
    const extensionData = await extensionRes.json().catch(() => ({}))
    const phoneData = await phoneRes.json().catch(() => ({}))
    const records = Array.isArray(phoneData?.records) ? phoneData.records as RingCentralPhoneNumber[] : []
    const normalizedFrom = normalizePhoneToE164(fromNumber)
    const matchedFrom = records.find(record => {
      const normalized = normalizePhoneToE164(record.phoneNumber ?? '')
      return normalized.isE164 && normalized.normalized === normalizedFrom.normalized
    })
    const features = matchedFrom?.features ?? []
    const hasRingOutScope = scopes.includes('RingOut')
    const canUseCallerId = features.includes('CallerId') || features.includes('RingOut')

    let message = 'RingCentral JWT auth succeeded.'
    if (!hasRingOutScope) message += ' RingOut scope missing.'
    else message += ' RingOut scope present.'
    if (!matchedFrom) message += ' RINGCENTRAL_FROM_NUMBER does not belong to authenticated extension.'
    else if (features.includes('SmsSender')) message += ' From number appears SMS-capable.'
    else message += ' From number does not appear SMS-capable.'

    return {
      ...base,
      configured: true,
      authStatus: 'ok',
      message,
      authenticatedExtension: {
        id: extensionData?.id ? String(extensionData.id) : undefined,
        extensionNumber: extensionData?.extensionNumber ? String(extensionData.extensionNumber) : undefined,
        name: extensionData?.name ? String(extensionData.name) : undefined,
        email: extensionData?.contact?.email ? String(extensionData.contact.email) : undefined,
      },
      scopes,
      phoneNumbers: records.map(record => ({
        phoneNumber: record.phoneNumber ?? '',
        type: record.type ?? record.usageType ?? '',
        features: record.features ?? [],
      })),
      fromNumber: {
        value: fromNumber,
        ownedByAuthenticatedExtension: Boolean(matchedFrom),
        smsCapable: Boolean(matchedFrom?.features?.includes('SmsSender')),
        callCapable: Boolean(matchedFrom && (hasRingOutScope || canUseCallerId)),
      },
    }
  } catch (err) {
    return {
      ...base,
      authStatus: 'error',
      message: `RingCentral diagnostics failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

async function resendDiagnostics() {
  const provider = process.env.EMAIL_PROVIDER
  const missingEnv = missing(['EMAIL_PROVIDER', 'RESEND_API_KEY', 'EMAIL_FROM_DEFAULT'])
  if (provider && provider !== 'resend') {
    return {
      configured: false,
      status: 'error',
      message: `Unsupported EMAIL_PROVIDER for Resend diagnostics: ${provider}.`,
      fromDefault: process.env.EMAIL_FROM_DEFAULT ?? null,
      replyToDefault: process.env.EMAIL_REPLY_TO_DEFAULT ?? null,
    }
  }
  if (missingEnv.length) {
    return {
      configured: false,
      status: 'not_configured',
      message: `Email provider is not configured. Missing: ${missingEnv.join(', ')}.`,
      fromDefault: process.env.EMAIL_FROM_DEFAULT ?? null,
      replyToDefault: process.env.EMAIL_REPLY_TO_DEFAULT ?? null,
    }
  }
  return {
    configured: true,
    status: 'ok',
    message: 'Resend appears configured. Use Send test email to verify sender/domain and API key.',
    fromDefault: process.env.EMAIL_FROM_DEFAULT ?? null,
    replyToDefault: process.env.EMAIL_REPLY_TO_DEFAULT ?? null,
  }
}

async function stripeDiagnostics() {
  const secret = process.env.STRIPE_SECRET_KEY
  const missingEnv = missing(['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'])
  const mode = secret?.startsWith('sk_live_') ? 'live' : secret?.startsWith('sk_test_') ? 'test' : 'unknown'
  if (missingEnv.length) {
    return {
      configured: false,
      status: 'not_configured',
      mode,
      message: `Stripe is not configured. Missing: ${missingEnv.join(', ')}.`,
    }
  }

  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        configured: true,
        status: 'error',
        mode,
        message: `Stripe API failed: ${parseProviderError(data, 'Unable to verify Stripe API key.')}`,
      }
    }
    return {
      configured: true,
      status: 'ok',
      mode,
      message: 'Stripe API key verified with a read-only balance request.',
    }
  } catch (err) {
    return {
      configured: true,
      status: 'error',
      mode,
      message: `Stripe diagnostics failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

async function portalDiagnostics() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const result = {
    appUrlPresent: Boolean(appUrl),
    appUrl: appUrl ?? null,
    portalBaseUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/portal/estimate` : null,
    estimatePortalLinksTable: { available: false, message: 'Not checked.' },
    estimateSignaturesTable: { available: false, message: 'Not checked.' },
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    result.estimatePortalLinksTable.message = 'SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing.'
    result.estimateSignaturesTable.message = 'SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing.'
    return result
  }

  try {
    const admin = createAdminClient()
    const [links, signatures] = await Promise.all([
      admin.from('estimate_portal_links').select('id').limit(1),
      admin.from('estimate_signatures').select('id').limit(1),
    ])

    result.estimatePortalLinksTable = links.error
      ? { available: false, message: links.error.message }
      : { available: true, message: 'estimate_portal_links table is available.' }
    result.estimateSignaturesTable = signatures.error
      ? { available: false, message: signatures.error.message }
      : { available: true, message: 'estimate_signatures table is available.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Supabase diagnostics error'
    result.estimatePortalLinksTable.message = message
    result.estimateSignaturesTable.message = message
  }

  return result
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { role } = auth.context
  const normalizedRole = normalizeRole(role)
  if (!['owner', 'admin', 'manager'].includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [ringcentral, resend, stripe, portal] = await Promise.all([
    ringCentralDiagnostics(),
    resendDiagnostics(),
    stripeDiagnostics(),
    portalDiagnostics(),
  ])

  return NextResponse.json({
    environment: getEnvironment(),
    resend,
    ringcentral,
    stripe,
    portal,
    generatedAt: new Date().toISOString(),
    requestId: req.headers.get('x-vercel-id') ?? null,
  })
}
