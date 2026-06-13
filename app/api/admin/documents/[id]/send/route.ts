import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildRenderContext } from '@/lib/documents/build-context'
import { renderDocument, buildDocumentNumber } from '@/lib/documents/render'
import { sendEmail, isEmailConfigured } from '@/lib/email/sendEmail'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kratos-crm.vercel.app'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('*, template:document_templates(content_html)')
      .eq('id', params.id)
      .neq('is_deleted', true)
      .maybeSingle()

    if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const ctx = await buildRenderContext(doc.opportunity_id)
    const docNumber = doc.document_number ?? buildDocumentNumber(ctx.opportunity_number, doc.category)

    const templateHtml = (doc.template as { content_html?: string } | null)?.content_html
    const renderedHtml = templateHtml
      ? renderDocument(templateHtml, ctx, docNumber)
      : (doc.rendered_html ?? '')

    const customerEmail = ctx.customer?.email
    if (!customerEmail) {
      return NextResponse.json({ error: 'Customer has no email address on file' }, { status: 422 })
    }

    const customerName = ctx.customer?.full_name ?? 'Valued Customer'
    const firstName = customerName.split(' ')[0] || customerName
    const portalUrl = `${APP_URL}/portal/documents/${params.id}`

    // Always freeze the snapshot and mark sent — regardless of whether email works
    await supabase
      .from('documents')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_to: customerEmail,
        rendered_html: renderedHtml,
        rendered_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    // Log to the sales timeline — anything sent to the customer should appear there
    if (doc.opportunity_id) {
      await supabase.from('communications').insert({
        opportunity_id: doc.opportunity_id,
        type: 'email',
        direction: 'outbound',
        subject: `Document sent: ${doc.name}`,
        body: `Sent "${doc.name}" to ${customerEmail} for review and signature.`,
        email_to: customerEmail,
        created_by: user.id,
      })
    }

    // Try to send email — if not configured, return the portal link so admin can share manually
    if (!isEmailConfigured()) {
      return NextResponse.json({
        ok: true,
        sentTo: customerEmail,
        emailSent: false,
        portalUrl,
        warning: 'Email is not configured on this server. Share the portal link below with the customer manually.',
      })
    }

    try {
      await sendEmail({
        to: customerEmail,
        subject: `Action Required: Review ${doc.name}`,
        html: buildSignatureRequestEmail({ firstName, docName: doc.name as string, portalUrl }),
        text: `Hi ${firstName},\n\nWe kindly request your attention to review the following document related to your upcoming move with Kratos Moving Inc.\n\nDocument: ${doc.name}\n\nView and sign here:\n${portalUrl}\n\nThank you,\nKratos Moving Inc.`,
      })
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : 'Email send failed'
      return NextResponse.json({
        ok: true,
        sentTo: customerEmail,
        emailSent: false,
        portalUrl,
        warning: `Email failed: ${msg}. Share the portal link below with the customer manually.`,
      })
    }

    return NextResponse.json({ ok: true, sentTo: customerEmail, emailSent: true, portalUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[documents/send]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildSignatureRequestEmail({
  firstName,
  docName,
  portalUrl,
}: {
  firstName: string
  docName: string
  portalUrl: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.12)">
        <tr>
          <td style="background:#111111;padding:18px 32px;text-align:center">
            <img src="${APP_URL}/logo.png" alt="Kratos Moving" width="48" height="48" style="display:inline-block;vertical-align:middle;margin-right:10px;object-fit:contain">
            <span style="color:#ffad33;font-size:18px;font-weight:700;letter-spacing:-0.3px;vertical-align:middle">KRATOS MOVING</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffad33;padding:18px 32px">
            <p style="margin:0 0 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#92400e">Action Required</p>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#111111">Please Review: ${escapeHtml(docName)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 6px;font-size:16px;color:#0f172a;font-weight:600">Dear ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.65">
              We kindly request your attention to review the following document related to your upcoming move with
              Kratos Moving Inc. Please click the button below to view and sign your document at your convenience.
            </p>
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8">Document</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:28px">
              <span style="font-size:15px;font-weight:600;color:#0f172a">${escapeHtml(docName)}</span>
            </div>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#ffad33;border-radius:8px">
                  <a href="${portalUrl}"
                     style="display:block;padding:14px 36px;font-size:15px;font-weight:700;color:#111111;text-decoration:none;text-align:center">
                    View Document &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:#94a3b8">
              Or copy this link into your browser:<br>
              <a href="${portalUrl}" style="color:#ffad33;word-break:break-all;font-size:12px">${portalUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
              Questions? Call us at <strong style="color:#475569">(800) 321-3222</strong> or reply to this email.<br>
              Kratos Moving Inc. &mdash; Ontario, Canada
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
