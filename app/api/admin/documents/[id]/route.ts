import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildRenderContext } from '@/lib/documents/build-context'
import { renderDocument, buildDocumentNumber } from '@/lib/documents/render'

const ALLOWED = new Set(['status', 'sent_to'])

// Documents at these statuses have a frozen snapshot — return as-is without re-rendering
const FROZEN_STATUSES = new Set(['sent', 'viewed', 'signed', 'completed'])

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Frozen statuses: return stored snapshot unchanged — unless caller requests a fresh preview
  const fresh = req.nextUrl.searchParams.get('fresh') === 'true'
  if (FROZEN_STATUSES.has(doc.status) && !fresh) {
    return NextResponse.json(doc)
  }

  // not_started / generated: live-render from current opportunity data
  if (!doc.template_id) {
    return NextResponse.json({
      ...doc,
      rendered_html: '<p><em>Template was deleted. Cannot re-render.</em></p>',
    })
  }

  const { data: template } = await supabase
    .from('document_templates')
    .select('id, content_html')
    .eq('id', doc.template_id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (!template) {
    return NextResponse.json({
      ...doc,
      rendered_html: doc.rendered_html ?? '<p><em>Template not found.</em></p>',
    })
  }

  try {
    const ctx = await buildRenderContext(doc.opportunity_id)
    const docNumber = doc.document_number ?? buildDocumentNumber(ctx.opportunity_number, doc.category)
    const freshHtml = renderDocument(template.content_html ?? '', ctx, docNumber)
    return NextResponse.json({ ...doc, rendered_html: freshHtml })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[doc preview render]', msg)
    return NextResponse.json({
      ...doc,
      rendered_html: doc.rendered_html ?? `<p><em>Render error: ${msg}</em></p>`,
    })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const cleaned: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED.has(k)),
  )

  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // When manually marking as signed from the CRM, capture the timestamp
  if (cleaned.status === 'signed') {
    cleaned.signed_at = new Date().toISOString()
  }

  // When marking as sent, capture the current rendered HTML as a frozen snapshot
  if (cleaned.status === 'sent') {
    cleaned.sent_at = new Date().toISOString()

    // Load the document to get template_id and opportunity_id
    const { data: doc } = await supabase
      .from('documents')
      .select('template_id, opportunity_id, document_number, category, rendered_html')
      .eq('id', params.id)
      .neq('is_deleted', true)
      .maybeSingle()

    if (doc?.template_id) {
      const { data: template } = await supabase
        .from('document_templates')
        .select('content_html')
        .eq('id', doc.template_id)
        .neq('is_deleted', true)
        .maybeSingle()

      if (template?.content_html) {
        try {
          const ctx = await buildRenderContext(doc.opportunity_id)
          const docNumber = doc.document_number ?? buildDocumentNumber(ctx.opportunity_number, doc.category)
          cleaned.rendered_html = renderDocument(template.content_html, ctx, docNumber)
          cleaned.rendered_at = new Date().toISOString()
        } catch (e: unknown) {
          console.error('[doc mark-sent render]', e instanceof Error ? e.message : e)
          // Fall back to whatever was already stored — don't fail the status update
        }
      }
    }
  }

  const { data: updated, error } = await supabase
    .from('documents')
    .update(cleaned)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('documents')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
