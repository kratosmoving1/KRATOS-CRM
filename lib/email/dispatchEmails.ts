// Email templates for dispatch: crew job notification + customer move confirmation.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kratos-crm.vercel.app'
const COMPANY_PHONE = '(800) 321-3222'

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.10)">
        <tr><td style="background:#111111;padding:18px 32px;text-align:center">
          <img src="${APP_URL}/logo.png" alt="Kratos Moving" width="44" height="44" style="display:inline-block;vertical-align:middle;margin-right:10px;object-fit:contain">
          <span style="color:#ffad33;font-size:17px;font-weight:700;letter-spacing:-0.3px;vertical-align:middle">KRATOS MOVING</span>
        </td></tr>
        ${inner}
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
            Questions? Call <strong style="color:#475569">${COMPANY_PHONE}</strong>.<br>Kratos Moving Inc. &mdash; Ontario, Canada
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#94a3b8;width:120px;vertical-align:top">${esc(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600">${esc(value)}</td>
  </tr>`
}

// ── Crew job notification ──────────────────────────────────────────────────────

export function buildCrewJobEmail(opts: {
  crewFirstName: string
  roleLabel: string
  dateLabel: string
  timeLabel: string
  origin: string
  destination: string
  crewName: string
}): { subject: string; html: string; text: string } {
  const subject = `You're scheduled — ${opts.dateLabel} at ${opts.timeLabel}`
  const portalUrl = `${APP_URL}/crew/jobs`
  const inner = `
    <tr><td style="background:#ffad33;padding:16px 32px">
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#92400e">New Assignment</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;color:#111111">You've been scheduled for a move</h1>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="margin:0 0 18px;font-size:15px;color:#0f172a">Hi ${esc(opts.crewFirstName)}, you're on the crew for an upcoming Kratos Moving job. Please open the crew app to <strong>accept or decline</strong>.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:6px 16px;margin-bottom:22px">
        ${row('Date', opts.dateLabel)}
        ${row('Arrival time', opts.timeLabel)}
        ${row('Your role', opts.roleLabel)}
        ${row('Crew', opts.crewName)}
        ${row('Pick-up', opts.origin || '—')}
        ${row('Drop-off', opts.destination || '—')}
      </table>
      <table cellpadding="0" cellspacing="0"><tr><td style="background:#0f172a;border-radius:8px">
        <a href="${portalUrl}" style="display:block;padding:13px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;text-align:center">Open Crew App &rarr;</a>
      </td></tr></table>
    </td></tr>`
  const text = `Hi ${opts.crewFirstName}, you've been scheduled for a Kratos Moving job.\n\nDate: ${opts.dateLabel}\nArrival: ${opts.timeLabel}\nRole: ${opts.roleLabel}\nPick-up: ${opts.origin}\nDrop-off: ${opts.destination}\n\nOpen the crew app to accept or decline: ${portalUrl}`
  return { subject, html: shell(inner), text }
}

// ── Customer move confirmation ─────────────────────────────────────────────────

export function buildCustomerConfirmationEmail(opts: {
  customerFirstName: string
  quoteNumber: string
  dateLabel: string
  arrivalLabel: string
  origin: string
  destination: string
}): { subject: string; html: string; text: string } {
  const subject = `Your move is confirmed — ${opts.dateLabel}`
  const inner = `
    <tr><td style="background:#ffad33;padding:16px 32px">
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#92400e">Move Confirmed</p>
      <h1 style="margin:0;font-size:19px;font-weight:700;color:#111111">Your move is locked in</h1>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="margin:0 0 6px;font-size:16px;color:#0f172a;font-weight:600">Hi ${esc(opts.customerFirstName)},</p>
      <p style="margin:0 0 18px;font-size:14px;color:#475569;line-height:1.65">Great news — your move with Kratos Moving Inc. is officially confirmed. Here are your details:</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:6px 16px;margin-bottom:22px">
        ${row('Reference', `#${opts.quoteNumber}`)}
        ${row('Move date', opts.dateLabel)}
        ${row('Arrival window', opts.arrivalLabel)}
        ${row('Pick-up', opts.origin || '—')}
        ${row('Drop-off', opts.destination || '—')}
      </table>
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6">Our crew will arrive within your scheduled arrival window. If anything changes, we'll reach out right away. Questions? Call ${COMPANY_PHONE}.</p>
    </td></tr>`
  const text = `Hi ${opts.customerFirstName},\n\nYour move with Kratos Moving Inc. is confirmed.\n\nReference: #${opts.quoteNumber}\nMove date: ${opts.dateLabel}\nArrival window: ${opts.arrivalLabel}\nPick-up: ${opts.origin}\nDrop-off: ${opts.destination}\n\nQuestions? Call ${COMPANY_PHONE}.`
  return { subject, html: shell(inner), text }
}
