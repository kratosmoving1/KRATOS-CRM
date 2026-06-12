'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  documentId: string
  documentName: string
  renderedHtml: string
  isSigned: boolean
  signedAt: string | null
}

export default function DocumentSignPortal({
  documentId,
  documentName,
  renderedHtml,
  isSigned: initialSigned,
  signedAt: initialSignedAt,
}: Props) {
  const [name, setName]         = useState('')
  const [agreed, setAgreed]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [signed, setSigned]     = useState(initialSigned)
  const [signedAt, setSignedAt] = useState(initialSignedAt)
  const [error, setError]       = useState<string | null>(null)

  async function handleSign() {
    setError(null)
    if (!name.trim()) { setError('Please type your full name.'); return }
    if (!agreed) { setError('Please confirm you have read and agree to the document.'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/portal/documents/${documentId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Sign failed.'); return }
      setSigned(true)
      setSignedAt(data.signed_at)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <header style={{ background: '#111111', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Image src="/logo.png" alt="Kratos" width={32} height={32} style={{ objectFit: 'contain' }} />
        <span style={{ color: '#ffad33', fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>KRATOS MOVING</span>
      </header>

      {/* Sub-header */}
      <div style={{ background: '#ffad33', padding: '14px 24px' }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#92400e' }}>
          Document Review
        </p>
        <h1 style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 700, color: '#111111' }}>
          {documentName}
        </h1>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Document body */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          {renderedHtml ? (
            <div
              style={{ padding: '32px 40px' }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center', fontSize: 14 }}>
              Document content unavailable. Please contact Kratos Moving at (800) 321-3222.
            </div>
          )}
        </div>

        {/* Sign section */}
        {signed ? (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '28px 32px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#166534' }}>Document Signed</h2>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: '#15803d' }}>
              Thank you. Your signature has been recorded.
            </p>
            {signedAt && (
              <p style={{ margin: 0, fontSize: 12, color: '#4ade80' }}>
                Signed on {new Date(signedAt).toLocaleString('en-CA', {
                  month: 'long', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}
            <p style={{ margin: '20px 0 0', fontSize: 13, color: '#15803d' }}>
              A copy has been saved to your file. Contact Kratos Moving at (800) 321-3222 with any questions.
            </p>
          </div>
        ) : (
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '28px 32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Sign Document</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b' }}>
              By signing below, you confirm you have read and understood this document.
            </p>

            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#475569' }}>
              Full Name (as signature)
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Type your full legal name"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                border: '1.5px solid #e2e8f0',
                borderRadius: 8,
                padding: '11px 14px',
                fontSize: 15,
                color: '#0f172a',
                outline: 'none',
                marginBottom: 18,
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#ffad33' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
            />

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 22 }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: '#ffad33', flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                I have read and understood the above document and agree to its terms and conditions.
              </span>
            </label>

            {error && (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSign}
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                background: loading ? '#fcd28b' : '#ffad33',
                border: 'none',
                borderRadius: 8,
                padding: '14px 0',
                fontSize: 15,
                fontWeight: 700,
                color: '#111111',
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.2px',
              }}
            >
              {loading ? 'Signing...' : 'Sign Document'}
            </button>

            <p style={{ margin: '16px 0 0', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
              Your IP address and timestamp are recorded as part of this digital signature.
            </p>
          </div>
        )}

        {/* Footer */}
        <p style={{ margin: '32px 0 0', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          Questions? Call <strong style={{ color: '#64748b' }}>(800) 321-3222</strong> or email us. &mdash; Kratos Moving Inc.
        </p>
      </div>
    </div>
  )
}
