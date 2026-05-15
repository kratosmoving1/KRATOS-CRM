import { createClient } from '@/lib/supabase/server'

/**
 * Minimal RingCentral client skeleton.
 * - Does not hardcode credentials
 * - Reads configuration from environment variables
 * - Returns helper methods for sending SMS/calls
 *
 * NOTE: This is a skeleton — install and wire the official RingCentral SDK
 * when ready. See RINGCENTRAL_TODO.md for required steps.
 */

const RC_CLIENT_ID = process.env.RINGCENTRAL_CLIENT_ID
const RC_CLIENT_SECRET = process.env.RINGCENTRAL_CLIENT_SECRET
const RC_JWT = process.env.RINGCENTRAL_JWT
const RC_SERVER = process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com'
const RC_FROM = process.env.RINGCENTRAL_FROM_NUMBER

export function isRingCentralConfigured() {
  return Boolean(RC_CLIENT_ID && RC_CLIENT_SECRET && (RC_JWT || RC_FROM))
}

export async function sendSmsViaRingCentral({ to, from, text }: { to: string; from: string; text: string }) {
  if (!isRingCentralConfigured()) throw new Error('RingCentral is not configured')
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
