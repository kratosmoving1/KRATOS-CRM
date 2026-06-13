import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import DocumentSignPortal from '@/components/portal/DocumentSignPortal'
import { buildRenderContext } from '@/lib/documents/build-context'
import { renderDocument, buildDocumentNumber } from '@/lib/documents/render'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function PortalError({ title }: { title: string }) {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ textAlign: 'center', color: '#fff', padding: '0 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
          Please contact Kratos Moving at (800) 321-3222.
        </p>
      </div>
    </main>
  )
}

export default async function DocumentPortalPage({ params }: { params: { id: string } }) {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return <PortalError title="Document portal unavailable" />
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, name, category, status, rendered_html, signed_at, signature_data, opportunity_id, document_number, template:document_templates(content_html)')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!doc) notFound()

  // Mark as viewed on first open (eq guard prevents race conditions)
  if (doc.status === 'sent') {
    await supabase
      .from('documents')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', doc.id)
      .eq('status', 'sent')
  }

  const isSigned = ['signed', 'completed'].includes(doc.status)
  const sigData  = doc.signature_data as Record<string, string> | null

  // Self-heal: if the frozen snapshot still contains unrendered {{tokens}}
  // (rendered by an older code version), re-render it now — stamping the
  // signature back in if already signed — and persist the repair.
  let renderedHtml = doc.rendered_html ?? ''
  const templateHtml = (doc.template as { content_html?: string } | null)?.content_html
  if (/\{\{[a-z_]+\}\}/.test(renderedHtml) && templateHtml && doc.opportunity_id) {
    try {
      const ctx = await buildRenderContext(doc.opportunity_id)
      const docNumber = doc.document_number ?? buildDocumentNumber(ctx.opportunity_number, doc.category)
      const signature = (isSigned && sigData?.signer_name && sigData?.signature_image && doc.signed_at)
        ? { signerName: sigData.signer_name, signatureImage: sigData.signature_image, signedAt: doc.signed_at }
        : undefined
      renderedHtml = renderDocument(templateHtml, ctx, docNumber, signature)
      await supabase
        .from('documents')
        .update({ rendered_html: renderedHtml, rendered_at: new Date().toISOString() })
        .eq('id', doc.id)
    } catch {
      // keep the stored snapshot — never block the customer from viewing
    }
  }

  return (
    <DocumentSignPortal
      documentId={doc.id}
      documentName={doc.name}
      renderedHtml={renderedHtml}
      isSigned={isSigned}
      signedAt={isSigned ? (doc.signed_at ?? null) : null}
      signedBy={isSigned ? (sigData?.signer_name ?? null) : null}
      signatureImage={isSigned ? (sigData?.signature_image ?? null) : null}
    />
  )
}
