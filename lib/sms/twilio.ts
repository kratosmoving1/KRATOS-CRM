/** Twilio SMS via REST API — no SDK, server-side only. */

export interface TwilioSmsResult {
  sid: string
  status: string
  to: string
  from: string
  errorCode?: string | null
  errorMessage?: string | null
}

function getCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(`Twilio is not fully configured. Missing: ${[
      !accountSid && 'TWILIO_ACCOUNT_SID',
      !authToken  && 'TWILIO_AUTH_TOKEN',
      !fromNumber && 'TWILIO_FROM_NUMBER',
    ].filter(Boolean).join(', ')}.`)
  }

  return { accountSid, authToken, fromNumber }
}

export async function sendSmsTwilio(to: string, body: string): Promise<TwilioSmsResult> {
  const { accountSid, authToken, fromNumber } = getCredentials()

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`

  const payload = new URLSearchParams({ To: to, From: fromNumber, Body: body })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  })

  const data = await res.json().catch(() => ({})) as Record<string, unknown>

  if (!res.ok) {
    const code = data.code ? String(data.code) : null
    const msg  = data.message ? String(data.message) : 'Twilio SMS failed.'
    const err  = new Error(msg) as Error & { twilioCode?: string }
    err.twilioCode = code ?? undefined
    throw err
  }

  return {
    sid:          String(data.sid ?? ''),
    status:       String(data.status ?? ''),
    to:           String(data.to ?? ''),
    from:         String(data.from ?? ''),
    errorCode:    data.error_code ? String(data.error_code) : null,
    errorMessage: data.error_message ? String(data.error_message) : null,
  }
}
