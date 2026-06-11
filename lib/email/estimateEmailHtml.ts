export interface CancellationEmailData {
  customerFirstName: string
  quoteNumber: string
  companyPhone: string
  cancellationReason?: string
}

export interface EstimateEmailData {
  customerFirstName: string
  customerFullName: string
  agentFirstName: string
  quoteNumber: string
  moveDate: string
  serviceType: string
  originAddress: string
  destinationAddress: string
  estimateLink: string
  depositAmount: string
  companyPhone: string
  badges?: Array<{ name: string; image_url: string | null }>
}

export interface BookingConfirmationData {
  customerFirstName: string
  customerFullName: string
  quoteNumber: string
  moveDate: string
  serviceType: string
  originAddress: string
  destinationAddress: string
  companyPhone: string
  agentFirstName: string
}

const KRATOS_ORANGE = '#ffad33'
const KRATOS_DARK   = '#0f172a'

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Kratos Moving</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      ${content}
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center">
      Kratos Moving Inc. · 1 (800) 321-3222 · kratosmoving.com
    </p>
  </td></tr>
</table>
</body>
</html>`
}

export function buildEstimateEmailHtml(d: EstimateEmailData): string {
  const badgesHtml = d.badges && d.badges.some(b => b.image_url)
    ? `<tr><td style="padding:24px 40px 8px">
        <table cellpadding="0" cellspacing="0"><tr>
          ${d.badges.filter(b => b.image_url).map(b =>
            `<td style="padding:0 8px 0 0"><img src="${b.image_url}" alt="${b.name}" height="56" style="height:56px;width:auto;object-fit:contain" /></td>`
          ).join('')}
        </tr></table>
       </td></tr>`
    : ''

  const content = `
      <!-- Header strip -->
      <tr><td style="background:${KRATOS_DARK};padding:28px 40px">
        <img src="https://kratos-crm.vercel.app/logo.png" alt="Kratos Moving" height="48" style="height:48px;width:auto" />
      </td></tr>

      <!-- Title -->
      <tr><td style="padding:36px 40px 0">
        <h1 style="margin:0;font-size:26px;font-weight:bold;color:${KRATOS_DARK};line-height:1.2">Your Moving Estimate!</h1>
      </td></tr>

      <!-- Greeting + body -->
      <tr><td style="padding:20px 40px 0;font-size:15px;color:${KRATOS_DARK};line-height:1.7">
        <p style="margin:0 0 16px">Dear <strong>${d.customerFirstName},</strong></p>
        <p style="margin:0 0 16px">
          Your Kratos Moving estimate is ready. We've reviewed the details of your move and prepared a clear,
          transparent quote so you know exactly what's included before you commit. Your quote is all-inclusive.
          No hidden fees. No surprise add-ons at the end of the day. The price you see is the price you pay —
          <em>unless</em> your estimate explicitly states otherwise.
        </p>
        <p style="margin:0 0 16px">
          Our 5-star movers are <strong><u>hardworking, respectful, and trained</u></strong> to handle every
          move with care. From careful packing to disciplined execution, our team is built to live up to the
          Kratos standard: show up prepared, protect every item, and finish the job properly.
        </p>
        <p style="margin:0 0 24px">
          In other words, we get it <strong style="color:${KRATOS_ORANGE}">Done As Promised.</strong>
        </p>
      </td></tr>

      ${badgesHtml}

      <!-- Stats -->
      <tr><td style="padding:16px 40px 8px;font-size:14px;color:${KRATOS_DARK};line-height:1.9">
        <p style="margin:0">&#9733; 4.9 rating on Google — 1,500 verified reviews (across all Kratos branches)</p>
        <p style="margin:0">&#127942; HomeStars Best of Award — 2025</p>
        <p style="margin:0">&#129352; Fully insured &amp; licensed Canadian movers</p>
        <p style="margin:0">&#129352; 10,000+ successful moves completed &#127464;&#127462;</p>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:20px 40px"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0" /></td></tr>

      <!-- Move details table -->
      <tr><td style="padding:0 40px 24px">
        <p style="margin:0 0 12px;font-size:15px;font-weight:bold;color:${KRATOS_ORANGE}">Your Move Details:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:120px;vertical-align:top"><strong>Customer</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.customerFullName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;vertical-align:top"><strong>Move Date</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.moveDate || 'To be confirmed'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;vertical-align:top"><strong>Service Type</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.serviceType || 'Moving'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;vertical-align:top"><strong>Origin</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.originAddress || 'See estimate'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;vertical-align:top"><strong>Destination</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.destinationAddress || 'See estimate'}</td>
          </tr>
        </table>
      </td></tr>

      <!-- CTA button -->
      <tr><td align="center" style="padding:8px 40px 40px">
        <a href="${d.estimateLink}" style="display:inline-block;background:${KRATOS_ORANGE};color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 48px;border-radius:6px;letter-spacing:0.02em">
          View Estimate
        </a>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center">
          Or copy this link: <a href="${d.estimateLink}" style="color:#64748b">${d.estimateLink}</a>
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">
          Questions? Reply to this email or call us at <strong>${d.companyPhone}</strong>.<br />
          ${d.agentFirstName ? `Your coordinator: <strong>${d.agentFirstName}</strong> · ` : ''}
          Estimate #${d.quoteNumber}
        </p>
      </td></tr>`

  return emailWrapper(content)
}

export function buildBookingConfirmationHtml(d: BookingConfirmationData): string {
  const content = `
      <!-- Header strip -->
      <tr><td style="background:${KRATOS_DARK};padding:28px 40px">
        <img src="https://kratos-crm.vercel.app/logo.png" alt="Kratos Moving" height="48" style="height:48px;width:auto" />
      </td></tr>

      <!-- Success badge -->
      <tr><td align="center" style="padding:36px 40px 24px">
        <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:64px;height:64px;line-height:64px;text-align:center;font-size:32px">&#10003;</div>
      </td></tr>

      <!-- Title -->
      <tr><td align="center" style="padding:0 40px 8px">
        <h1 style="margin:0;font-size:24px;font-weight:bold;color:${KRATOS_DARK}">Your Move is Booked!</h1>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:16px 40px 0;font-size:15px;color:${KRATOS_DARK};line-height:1.7;text-align:center">
        <p style="margin:0 0 16px">
          Hi <strong>${d.customerFirstName}</strong>, your estimate has been accepted and your move date is now on our schedule.
          A Kratos Moving coordinator will be in touch to confirm the details and answer any final questions.
        </p>
        <p style="margin:0 0 24px;color:#64748b;font-size:14px">
          In the meantime, you can reach us anytime at <strong>${d.companyPhone}</strong>.
        </p>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:4px 40px 20px"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0" /></td></tr>

      <!-- Move summary -->
      <tr><td style="padding:0 40px 32px">
        <p style="margin:0 0 12px;font-size:15px;font-weight:bold;color:${KRATOS_ORANGE}">Your Move Details:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:120px"><strong>Customer</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.customerFullName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b"><strong>Move Date</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.moveDate || 'To be confirmed'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b"><strong>Service Type</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.serviceType || 'Moving'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b"><strong>Origin</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.originAddress || 'See estimate'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b"><strong>Destination</strong></td>
            <td style="padding:6px 0;color:${KRATOS_DARK}">${d.destinationAddress || 'See estimate'}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">
          ${d.agentFirstName ? `Your coordinator: <strong>${d.agentFirstName}</strong> · ` : ''}
          Estimate #${d.quoteNumber}<br />
          <strong style="color:${KRATOS_ORANGE}">Done As Promised.</strong>
        </p>
      </td></tr>`

  return emailWrapper(content)
}

export function buildCancellationEmailHtml(d: CancellationEmailData): string {
  const content = `
      <!-- Header strip -->
      <tr><td style="background:${KRATOS_DARK};padding:28px 40px">
        <img src="https://kratos-crm.vercel.app/logo.png" alt="Kratos Moving" height="48" style="height:48px;width:auto" />
      </td></tr>

      <!-- Title -->
      <tr><td style="padding:36px 40px 8px">
        <h1 style="margin:0;font-size:24px;font-weight:bold;color:${KRATOS_DARK}">Your Booking Has Been Cancelled</h1>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:16px 40px 0;font-size:15px;color:${KRATOS_DARK};line-height:1.7">
        <p style="margin:0 0 16px">Hi <strong>${d.customerFirstName}</strong>,</p>
        <p style="margin:0 0 16px">
          We wanted to let you know that your Kratos Moving booking (Quote #${d.quoteNumber}) has been cancelled.
          ${d.cancellationReason ? `<br /><br />Reason: <em>${d.cancellationReason}</em>` : ''}
        </p>
        <p style="margin:0 0 24px">
          If this was a mistake or you'd like to rebook, please don't hesitate to reach out.
          We'd love to help you plan your next move.
        </p>
      </td></tr>

      <!-- Divider -->
      <tr><td style="padding:4px 40px 20px"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0" /></td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0">
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">
          Questions? Call us at <strong>${d.companyPhone}</strong>. · Quote #${d.quoteNumber}<br />
          <strong style="color:${KRATOS_ORANGE}">Done As Promised.</strong>
        </p>
      </td></tr>`

  return emailWrapper(content)
}
