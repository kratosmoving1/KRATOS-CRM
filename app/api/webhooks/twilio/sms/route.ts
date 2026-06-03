import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// Validate that the request genuinely came from Twilio.
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
function validateTwilioSignature(
  authToken: string,
  incomingSignature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  try {
    const sorted = Object.keys(params).sort()
    const strToSign = url + sorted.map(k => `${k}${params[k]}`).join('')
    const expected = crypto.createHmac('sha1', authToken).update(strToSign, 'utf8').digest('base64')
    // Use timingSafeEqual to avoid timing attacks
    const a = Buffer.from(incomingSignature)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// Strip non-digits and take the last 10 digits for comparison.
// Handles E164 (+12262801297), raw 10-digit (2262801297), and 11-digit (12262801297).
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

export async function POST(req: NextRequest) {
  const db = createAdminClient()

  // Twilio sends webhook bodies as application/x-www-form-urlencoded
  const rawBody = await req.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))

  // Validate Twilio signature before processing anything
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? ''
  const incomingSignature = req.headers.get('x-twilio-signature') ?? ''

  if (authToken && incomingSignature) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    const host  = req.headers.get('host') ?? 'kratos-crm.vercel.app'
    const url   = `${proto}://${host}/api/webhooks/twilio/sms`
    const valid = validateTwilioSignature(authToken, incomingSignature, url, params)
    if (!valid) {
      console.error('[Twilio/Inbound] Signature validation failed — possible spoofed request')
      // Return 200 to Twilio (don't reveal whether the endpoint exists)
      return new NextResponse('<Response/>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
    }
  } else if (!authToken) {
    console.warn('[Twilio/Inbound] TWILIO_AUTH_TOKEN not set — skipping signature validation')
  }

  const fromRaw   = params.From ?? ''
  const toRaw     = params.To   ?? ''
  const body      = params.Body?.trim() ?? ''
  const messageSid = params.MessageSid ?? ''

  if (!fromRaw || !body) {
    return new NextResponse('<Response/>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
  }

  const fromNormalized = normalizePhone(fromRaw)

  // Load all customers to match by phone. Acceptable for a small moving company;
  // add a DB phone-lookup index if the customer list grows to 10k+.
  const { data: allCustomers } = await db
    .from('customers')
    .select('id, phone, secondary_phone')
    .neq('is_deleted', true)

  const matchedCustomer = (allCustomers ?? []).find(c => {
    const primary   = normalizePhone(c.phone ?? '')
    const secondary = normalizePhone(c.secondary_phone ?? '')
    return primary === fromNormalized || (secondary && secondary === fromNormalized)
  }) ?? null

  let opportunityId: string | null = null

  if (matchedCustomer) {
    // Link to the most recent non-terminal opportunity
    const { data: opps } = await db
      .from('opportunities')
      .select('id')
      .eq('customer_id', matchedCustomer.id)
      .neq('is_deleted', true)
      .not('status', 'in', '("cancelled","closed")')
      .order('created_at', { ascending: false })
      .limit(1)

    opportunityId = opps?.[0]?.id ?? null
  }

  const { error } = await db.from('communications').insert({
    type:                'sms',
    direction:           'inbound',
    body,
    phone_number:        fromRaw,
    provider:            'twilio',
    provider_message_id: messageSid,
    status:              'received',
    customer_id:         matchedCustomer?.id ?? null,
    opportunity_id:      opportunityId,
  })

  if (error) {
    console.error('[Twilio/Inbound] Failed to save inbound SMS:', {
      error: error.message,
      from: fromRaw,
      messageSid,
    })
  } else {
    console.log('[Twilio/Inbound] Saved inbound SMS:', {
      from: fromRaw,
      to: toRaw,
      customerId: matchedCustomer?.id ?? null,
      opportunityId,
      messageSid,
    })
  }

  // Twilio requires a TwiML response — empty means no auto-reply
  return new NextResponse('<Response/>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}
