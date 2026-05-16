export type SendEmailInput = {
  to: string
  subject: string
  html: string
  text: string
  fromName?: string
  fromEmail?: string
  replyTo?: string
}

export type SendEmailResult = {
  provider: string
  id?: string | null
  raw: unknown
}

export function isEmailConfigured() {
  const provider = process.env.EMAIL_PROVIDER
  if (provider === 'resend') return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM_DEFAULT)
  if (provider === 'sendgrid') return Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM_DEFAULT)
  return false
}

export function emailConfigError() {
  const provider = process.env.EMAIL_PROVIDER
  const missing: string[] = []
  if (!provider) missing.push('EMAIL_PROVIDER')
  if (provider === 'resend' && !process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY')
  if (provider === 'sendgrid' && !process.env.SENDGRID_API_KEY) missing.push('SENDGRID_API_KEY')
  if (!process.env.EMAIL_FROM_DEFAULT) missing.push('EMAIL_FROM_DEFAULT')
  if (missing.length) return `Email provider is not configured. Missing: ${missing.join(', ')}.`
  if (provider !== 'resend' && provider !== 'sendgrid') return `Unsupported email provider: ${provider}`
  return 'Email provider is not configured.'
}

function parseAddress(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (!match) return { name: null, email: value.trim() }
  return { name: match[1]?.trim() || null, email: match[2]?.trim() ?? value.trim() }
}

function fromAddress(name: string | undefined, value: string) {
  if (value.includes('<')) return value
  return name ? `${name} <${value}>` : value
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  fromName,
  fromEmail,
  replyTo,
}: SendEmailInput): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER
  const defaultFrom = process.env.EMAIL_FROM_DEFAULT
  const defaultReplyTo = process.env.EMAIL_REPLY_TO_DEFAULT
  if (!isEmailConfigured() || !provider || !defaultFrom) throw new Error(emailConfigError())

  const sender = fromEmail || defaultFrom
  const parsedSender = parseAddress(sender)
  const reply = replyTo || defaultReplyTo || sender

  if (provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(fromName, sender),
        to,
        reply_to: reply,
        subject,
        html,
        text,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || data?.error || 'Email send failed.')
    return { provider, id: data.id ?? null, raw: data }
  }

  if (provider === 'sendgrid') {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: parsedSender.email, name: fromName || parsedSender.name || 'Kratos Moving' },
        reply_to: { email: reply },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    })
    const data = await res.text()
    if (!res.ok) throw new Error(data || 'Email send failed.')
    return { provider, id: res.headers.get('x-message-id'), raw: data }
  }

  throw new Error(emailConfigError())
}
