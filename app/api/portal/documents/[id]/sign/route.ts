import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  const body = await req.json().catch(() => ({}))
  const signerName     = typeof body.signer_name     === 'string' ? body.signer_name.trim()     : ''
  const signatureImage = typeof body.signature_image === 'string' ? body.signature_image.trim() : ''

  if (!signerName) {
    return NextResponse.json({ error: 'Please enter your full legal name.' }, { status: 400 })
  }
  if (!signatureImage || !signatureImage.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Signature drawing is required.' }, { status: 400 })
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, status')
    .eq('id', params.id)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!doc) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
  }

  if (['signed', 'completed'].includes(doc.status)) {
    return NextResponse.json({ error: 'This document has already been signed.' }, { status: 409 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const signedAt = new Date().toISOString()

  const { error } = await supabase
    .from('documents')
    .update({
      status: 'signed',
      signed_at: signedAt,
      signature_data: {
        signer_name:      signerName,
        signature_image:  signatureImage,
        signature_method: 'drawn',
        ip_address:       ip,
        user_agent:       req.headers.get('user-agent') ?? '',
        signed_at:        signedAt,
      },
    })
    .eq('id', params.id)

  if (error) {
    console.error('[documents/sign]', error.message)
    return NextResponse.json({ error: 'Failed to save signature. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, signed_at: signedAt })
}
