/**
 * SMS provider abstraction for Kratos CRM.
 *
 * Architecture: Twilio = SMS, RingCentral = calling only.
 *
 * Priority order:
 * 1. SMS_PROVIDER=disabled  → disabled
 * 2. Twilio vars all present → twilio  (wins even over SMS_PROVIDER=ringcentral)
 * 3. SMS_PROVIDER=twilio    → twilio   (env vars may be missing; status will say why)
 * 4. SMS_PROVIDER=ringcentral with NO Twilio → ringcentral (legacy fallback)
 * 5. Anything else          → disabled
 *
 * Rationale: RingCentral SMS is not active on this account (1-800 IVR number,
 * ringcentral_user_connections table not created). Twilio is the intended provider.
 * If Twilio vars are present, always use Twilio regardless of SMS_PROVIDER setting.
 */

export type SmsProvider = 'ringcentral' | 'twilio' | 'disabled'

export interface SmsDeliveryStatus {
  canSend: boolean
  provider: SmsProvider
  reason?: string
  recommendation?: string
}

function twilioVarsPresent(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER,
  )
}

/** Which provider is active. Twilio takes priority when its vars are present. */
export function getSmsProvider(): SmsProvider {
  const explicit = process.env.SMS_PROVIDER?.toLowerCase().trim()

  if (explicit === 'disabled') return 'disabled'

  // Twilio wins if vars are present — regardless of SMS_PROVIDER value.
  // This prevents RC from being used for SMS even if SMS_PROVIDER=ringcentral
  // is still set in env from a previous configuration.
  if (twilioVarsPresent()) return 'twilio'

  // Explicit Twilio requested but vars missing — report as twilio so
  // getSmsDeliveryStatus() can show the specific missing vars.
  if (explicit === 'twilio') return 'twilio'

  // RC SMS only as last resort if explicitly set and Twilio is not configured.
  if (explicit === 'ringcentral') return 'ringcentral'

  return 'disabled'
}

/** Synchronous capability check — no network calls. */
export function getSmsDeliveryStatus(): SmsDeliveryStatus {
  const provider = getSmsProvider()

  if (provider === 'disabled') {
    return {
      canSend: false,
      provider,
      reason: 'SMS is not configured.',
      recommendation:
        'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in Vercel. ' +
        'SMS_PROVIDER=twilio is optional — Twilio is auto-detected when all three vars are present.',
    }
  }

  if (provider === 'twilio') {
    const missing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'].filter(
      k => !process.env[k],
    )
    if (missing.length) {
      return {
        canSend: false,
        provider,
        reason: `Twilio SMS is not configured. Missing: ${missing.join(', ')}.`,
        recommendation:
          'Add the missing Twilio environment variables in Vercel → Settings → Environment Variables, then redeploy.',
      }
    }
    return { canSend: true, provider }
  }

  if (provider === 'ringcentral') {
    const missing = ['RINGCENTRAL_CLIENT_ID', 'RINGCENTRAL_CLIENT_SECRET', 'RINGCENTRAL_JWT'].filter(
      k => !process.env[k],
    )
    if (missing.length) {
      return {
        canSend: false,
        provider,
        reason: `RingCentral is selected but missing: ${missing.join(', ')}.`,
        recommendation:
          'Switch to Twilio by adding TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.',
      }
    }
    const smsFrom = process.env.RINGCENTRAL_SMS_FROM_NUMBER || process.env.RINGCENTRAL_FROM_NUMBER
    if (!smsFrom) {
      return {
        canSend: false,
        provider,
        reason: 'RINGCENTRAL_SMS_FROM_NUMBER is not set.',
        recommendation:
          'Switch to Twilio instead — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.',
      }
    }
    return { canSend: true, provider }
  }

  return { canSend: false, provider: 'disabled', reason: 'Unknown SMS provider.' }
}

/** Human-readable provider name for UI display. */
export function smsProviderLabel(provider: SmsProvider | string): string {
  if (provider === 'twilio') return 'Twilio'
  if (provider === 'ringcentral') return 'RingCentral'
  return provider
}
