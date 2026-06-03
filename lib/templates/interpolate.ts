const COMPANY_PHONE = '(800) 321-3222'

export type InterpolationContext = {
  customer: { full_name: string }
  opportunity: {
    opportunity_number: string | null
    service_date: string | null
    move_size: string | null
  }
  agent: { full_name: string }
}

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] || ''
}

function humanizeMoveSize(size: string | null | undefined): string {
  if (!size) return 'your move'
  return size
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatMoveDate(iso: string | null | undefined): string {
  if (!iso) return 'your move date'
  const d = new Date(iso)
  // Avoid timezone shift by parsing as local date (ISO date-only is YYYY-MM-DD)
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function interpolate(text: string, ctx: InterpolationContext): string {
  const replacements: Record<string, string> = {
    '{{customer_first_name}}': firstName(ctx.customer.full_name),
    '{{customer_full_name}}':  ctx.customer.full_name ?? '',
    '{{quote_number}}':        String(ctx.opportunity.opportunity_number ?? ''),
    '{{move_date}}':           formatMoveDate(ctx.opportunity.service_date),
    '{{move_size}}':           humanizeMoveSize(ctx.opportunity.move_size),
    '{{agent_first_name}}':    firstName(ctx.agent.full_name),
    '{{agent_full_name}}':     ctx.agent.full_name ?? '',
    '{{company_phone}}':       COMPANY_PHONE,
  }

  return Object.entries(replacements).reduce(
    (acc, [token, value]) => acc.split(token).join(value),
    text,
  )
}
