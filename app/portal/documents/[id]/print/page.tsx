import { createAdminClient } from '@/lib/supabase/admin'
import { buildRenderContext } from '@/lib/documents/build-context'
import { renderDocument, buildDocumentNumber } from '@/lib/documents/render'
import { notFound } from 'next/navigation'
import PrintDocument from '@/components/portal/PrintDocument'

export default async function PrintDocumentPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('*, template:document_templates(content_html)')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!doc) notFound()

  const sigData = doc.signature_data as Record<string, string> | null

  let renderedHtml = doc.rendered_html ?? ''

  const templateHtml = (doc.template as { content_html?: string } | null)?.content_html
  if (templateHtml && doc.opportunity_id) {
    try {
      const ctx = await buildRenderContext(doc.opportunity_id)
      const docNumber = doc.document_number ?? buildDocumentNumber(ctx.opportunity_number, doc.category)
      const signature = (sigData?.signer_name && sigData?.signature_image && doc.signed_at)
        ? { signerName: sigData.signer_name, signatureImage: sigData.signature_image, signedAt: doc.signed_at }
        : undefined
      renderedHtml = renderDocument(templateHtml, ctx, docNumber, signature)
    } catch {
      // fall back to stored snapshot
    }
  }

  return (
    <PrintDocument
      documentName={doc.name as string}
      documentNumber={doc.document_number}
      renderedHtml={renderedHtml}
      signerName={sigData?.signer_name ?? null}
      signatureImage={sigData?.signature_image ?? null}
      signedAt={doc.signed_at}
    />
  )
}
