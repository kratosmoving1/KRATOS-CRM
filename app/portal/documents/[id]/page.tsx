import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import DocumentSignPortal from '@/components/portal/DocumentSignPortal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function PortalError({ title }: { title: string }) {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
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
    .select('id, name, category, status, rendered_html, signed_at, signature_data')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!doc) notFound()

  // Mark as viewed on first open (sent → viewed); use eq guard to avoid race conditions
  if (doc.status === 'sent') {
    await supabase
      .from('documents')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', doc.id)
      .eq('status', 'sent')
  }

  const isSigned = ['signed', 'completed'].includes(doc.status)

  return (
    <DocumentSignPortal
      documentId={doc.id}
      documentName={doc.name}
      renderedHtml={doc.rendered_html ?? ''}
      isSigned={isSigned}
      signedAt={isSigned ? (doc.signed_at ?? null) : null}
    />
  )
}
