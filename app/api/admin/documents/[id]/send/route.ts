import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildRenderContext } from '@/lib/documents/build-context'
import { renderDocument, buildDocumentNumber } from '@/lib/documents/render'
import { sendEmail } from '@/lib/email/sendEmail'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load document + template
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('*, template:document_templates(content_html)')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Build fresh render
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

  const emailErr = await sendEmail({
    to: customerEmail,
    subject: `Please review and sign: ${doc.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <div style="background:#0a0a0a;padding:20px 24px;border-radius:8px 8px 0 0">
          <span style="color:#ffad33;font-size:18px;font-weight:700">Kratos Moving Inc.</span>
        </div>
        <div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0;border-top:none">
          <p style="font-size:16px;color:#0f172a;margin:0 0 16px">Hi ${firstName},</p>
          <p style="font-size:14px;color:#475569;margin:0 0 24px">
            Please review the following document from Kratos Moving. Once you've reviewed it,
            reply to this email or contact your moving coordinator to confirm.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px" />
          ${renderedHtml}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
          <p style="font-size:13px;color:#94a3b8;margin:0">
            Questions? Call us at ${process.env.COMPANY_PHONE ?? '(800) 321-3222'} or reply to this email.
          </p>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nPlease review the attached document from Kratos Moving: ${doc.name}.\n\nReply to this email or call (800) 321-3222 if you have questions.\n\nKratos Moving Inc.`,
  })

  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 500 })

  // Freeze snapshot + mark sent
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

  return NextResponse.json({ ok: true, sentTo: customerEmail })
}
