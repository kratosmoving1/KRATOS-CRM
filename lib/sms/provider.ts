/**
 * SMS provider abstraction for Kratos CRM.
 *
 * Reads SMS_PROVIDER env var (ringcentral | twilio | disabled).
 * Falls back to auto-detect based on which credentials are present.
 * All functions are server-side only.
 */

export type SmsProvider = 'ringcentral' | 'twilio' | 'disabled'

export interface SmsSendInput {
  to: string
  body: string
  fromOverride?: string
  accessToken?: string
}

export interface SmsSendResult {
  ok: boolean
  delivered: boolean
  provider: SmsProvider
  messageId?: string
  error?: string
  diagnostic?: string
}

export interface SmsDeliveryStatus {
  canSend: boolean
  provider: SmsProvider
  reason?: string
  recommendation?: string
}

/** Which provider is active based on env config. */
export function getSmsProvider(): SmsProvider {
  const explicit = process.env.SMS_PROVIDER?.toLowerCase()
  if (explicit === 'twilio') return 'twilio'
  if (explicit === 'ringcentral') return 'ringcentral'
  if (explicit === 'disabled') return 'disabled'

  // Auto-detect: prefer Twilio if fully configured
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  ) return 'twilio'

  // Fall back to RingCentral if credentials present
  if (process.env.RINGCENTRAL_CLIENT_ID && process.env.RINGCENTRAL_CLIENT_SECRET) {
    return 'ringcentral'
  }

  return 'disabled'
}

/**
 * Synchronous capability check — does NOT make network calls.
 * Used by the status API endpoint and Sales tab.
 */
export function getSmsDeliveryStatus(): SmsDeliveryStatus {
  const provider = getSmsProvider()

  if (provider === 'disabled') {
    return {
      canSend: false,
      provider,
      reason: 'SMS_PROVIDER is not configured.',
      recommendation: 'Set SMS_PROVIDER=twilio with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to enable SMS delivery.',
    }
  }

  if (provider === 'twilio') {
    const missing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'].filter(k => !process.env[k])
    if (missing.length) {
      return {
        canSend: false,
        provider,
        reason: `Twilio is selected but missing: ${missing.join(', ')}.`,
        recommendation: 'Add the missing Twilio environment variables in Vercel and redeploy.',
      }
    }
    return { canSend: true, provider }
  }

  if (provider === 'ringcentral') {
    const missing = ['RINGCENTRAL_CLIENT_ID', 'RINGCENTRAL_CLIENT_SECRET', 'RINGCENTRAL_JWT'].filter(k => !process.env[k])
    if (missing.length) {
      return {
        canSend: false,
        provider,
        reason: `RingCentral is selected but missing: ${missing.join(', ')}.`,
        recommendation: 'Add the missing RingCentral environment variables.',
      }
    }
    const smsFrom = process.env.RINGCENTRAL_SMS_FROM_NUMBER || process.env.RINGCENTRAL_FROM_NUMBER
    if (!smsFrom) {
      return {
        canSend: false,
        provider,
        reason: 'RINGCENTRAL_SMS_FROM_NUMBER is not set.',
        recommendation: 'Set RINGCENTRAL_SMS_FROM_NUMBER to an SMS-capable direct number on the authenticated extension.',
      }
    }
    // Env vars present — delivery might still fail at runtime if the number is not SMS-capable,
    // but we treat this as canSend=true and let the actual send surface the provider error.
    return { canSend: true, provider }
  }

  return { canSend: false, provider: 'disabled', reason: 'Unknown SMS provider.' }
}
