'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type SignaturePadType from 'signature_pad'

interface Props {
  documentId: string
  documentName: string
  renderedHtml: string
  isSigned: boolean
  signedAt: string | null
  signedBy: string | null
  signatureImage: string | null
}

// ── Signature pad hook ────────────────────────────────────────────────────────

function useSignaturePad() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const padRef      = useRef<SignaturePadType | null>(null)
  const [empty, setEmpty] = useState(true)

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !padRef.current) return
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const data  = padRef.current.toData()
    canvas.width  = canvas.offsetWidth  * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(ratio, ratio)
    padRef.current.clear()
    if (data.length) {
      padRef.current.fromData(data)
      setEmpty(false)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let SignaturePad: typeof SignaturePadType
    import('signature_pad').then(mod => {
      SignaturePad = mod.default
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width  = canvas.offsetWidth  * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(ratio, ratio)

      padRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255,255,255)',
        penColor: '#0f172a',
        minWidth: 1,
        maxWidth: 3,
      })

      padRef.current.addEventListener('endStroke', () => {
        setEmpty(padRef.current?.isEmpty() ?? true)
      })

      const ro = new ResizeObserver(resizeCanvas)
      ro.observe(canvas)

      return () => {
        ro.disconnect()
        padRef.current?.off()
      }
    })
  }, [resizeCanvas])

  function clearPad() {
    padRef.current?.clear()
    setEmpty(true)
  }

  function toDataURL(): string | null {
    if (!padRef.current || padRef.current.isEmpty()) return null
    return padRef.current.toDataURL('image/png')
  }

  return { canvasRef, empty, clearPad, toDataURL }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DocumentSignPortal({
  documentId,
  documentName,
  renderedHtml,
  isSigned: initialSigned,
  signedAt: initialSignedAt,
  signedBy,
  signatureImage: initialSigImage,
}: Props) {
  const [name, setName]         = useState('')
  const [agreed, setAgreed]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [signed, setSigned]     = useState(initialSigned)
  const [signedAt, setSignedAt] = useState(initialSignedAt)
  const [sigImage, setSigImage] = useState(initialSigImage)
  const [error, setError]       = useState<string | null>(null)

  const { canvasRef, empty: sigEmpty, clearPad, toDataURL } = useSignaturePad()

  async function handleSign() {
    setError(null)
    if (!name.trim())  { setError('Please enter your full legal name.'); return }
    if (sigEmpty)      { setError('Please draw your signature above.'); return }
    if (!agreed)       { setError('Please confirm you have read and agree to the document.'); return }

    const signatureData = toDataURL()
    if (!signatureData) { setError('Signature is empty. Please draw your signature.'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/portal/documents/${documentId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name:     name.trim(),
          signature_image: signatureData,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Signing failed. Please try again.'); return }
      setSigned(true)
      setSignedAt(data.signed_at)
      setSigImage(signatureData)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>

      {/* Header */}
      <header style={{
        background: '#0f172a',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid #1e293b',
      }}>
        <Image src="/logo.png" alt="Kratos" width={28} height={28} style={{ objectFit: 'contain' }} />
        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>
          Kratos Moving
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>Secure Document</span>
      </header>

      {/* Document title strip */}
      <div style={{
        background: '#1e293b',
        padding: '12px 20px',
        borderBottom: '1px solid #334155',
      }}>
        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>
          Document for Review &amp; Signature
        </p>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
          {documentName}
        </h1>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Document body */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          marginBottom: 24,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {renderedHtml ? (
            <div
              style={{ padding: '28px 32px' }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center', fontSize: 14 }}>
              Document content unavailable. Contact Kratos Moving at (800) 321-3222.
            </div>
          )}
        </div>

        {/* Signing state */}
        {signed ? (
          <SignedConfirmation signedAt={signedAt} signedBy={signedBy} sigImage={sigImage} />
        ) : (
          <SignForm
            name={name}
            setName={setName}
            agreed={agreed}
            setAgreed={setAgreed}
            canvasRef={canvasRef}
            sigEmpty={sigEmpty}
            clearPad={clearPad}
            error={error}
            loading={loading}
            onSign={handleSign}
          />
        )}

        {/* Footer */}
        <p style={{ margin: '28px 0 0', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
          Questions? Call{' '}
          <a href="tel:8003213222" style={{ color: '#64748b', fontWeight: 600 }}>(800) 321-3222</a>
          {' '}&mdash; Kratos Moving Inc.
        </p>
      </div>
    </div>
  )
}

// ── Signed state ──────────────────────────────────────────────────────────────

function SignedConfirmation({
  signedAt,
  signedBy,
  sigImage,
}: {
  signedAt: string | null
  signedBy: string | null
  sigImage: string | null
}) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-CA', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #d1fae5',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        background: '#ecfdf5',
        borderBottom: '1px solid #d1fae5',
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
        }}>✓</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#065f46' }}>Document Signed</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#059669' }}>
            Your signature has been recorded.
          </p>
        </div>
      </div>
      <div style={{ padding: '20px 24px' }}>
        {sigImage && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8' }}>
              Signature
            </p>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', background: '#fafafa', display: 'inline-block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sigImage} alt="Signature" style={{ maxWidth: 280, height: 80, objectFit: 'contain', display: 'block' }} />
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          {signedBy && (
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8' }}>Signed by</p>
              <p style={{ margin: 0, fontSize: 14, color: '#0f172a', fontWeight: 600 }}>{signedBy}</p>
            </div>
          )}
          {signedAt && (
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8' }}>Date &amp; time</p>
              <p style={{ margin: 0, fontSize: 13, color: '#0f172a' }}>{fmtDate(signedAt)}</p>
            </div>
          )}
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 4, background: '#0f172a', color: '#fff', fontSize: 10, flexShrink: 0,
            }}>✓</span>
            Signed electronically — A copy has been saved to your file.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Sign form ─────────────────────────────────────────────────────────────────

function SignForm({
  name, setName, agreed, setAgreed,
  canvasRef, sigEmpty, clearPad,
  error, loading, onSign,
}: {
  name: string
  setName: (v: string) => void
  agreed: boolean
  setAgreed: (v: boolean) => void
  canvasRef: React.RefObject<HTMLCanvasElement>
  sigEmpty: boolean
  clearPad: () => void
  error: string | null
  loading: boolean
  onSign: () => void
}) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Sign Document</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Complete all fields below to sign this document.
        </p>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* Name field */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: 'block', marginBottom: 6,
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#475569',
          }}>
            Full Legal Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Type your full legal name"
            autoComplete="name"
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box',
              border: '1.5px solid #e2e8f0', borderRadius: 8,
              padding: '11px 14px', fontSize: 15, color: '#0f172a',
              outline: 'none', fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#0f172a' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
          />
        </div>

        {/* Signature pad */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <label style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#475569',
            }}>
              Draw Your Signature
            </label>
            <button
              type="button"
              onClick={clearPad}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: '#94a3b8', fontWeight: 500,
                padding: '2px 6px', borderRadius: 4,
              }}
              onMouseOver={e => { e.currentTarget.style.color = '#ef4444' }}
              onMouseOut={e => { e.currentTarget.style.color = '#94a3b8' }}
            >
              Clear
            </button>
          </div>
          <div style={{
            border: `1.5px solid ${sigEmpty ? '#e2e8f0' : '#0f172a'}`,
            borderRadius: 8, overflow: 'hidden',
            background: '#fff', position: 'relative',
            transition: 'border-color 0.15s',
          }}>
            <canvas
              ref={canvasRef}
              style={{ display: 'block', width: '100%', height: 160, touchAction: 'none', cursor: 'crosshair' }}
            />
            {sigEmpty && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                  Sign with finger or mouse
                </span>
              </div>
            )}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94a3b8' }}>
            Draw your signature above using your finger (mobile) or mouse/trackpad.
          </p>
        </div>

        {/* Agreement checkbox */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          cursor: 'pointer', marginBottom: 20,
          padding: '12px 14px',
          background: '#f8fafc', borderRadius: 8,
          border: `1px solid ${agreed ? '#0f172a' : '#e2e8f0'}`,
          transition: 'border-color 0.15s',
        }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: '#0f172a' }}
          />
          <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            I have read and understood the above document and agree to its terms and conditions.
          </span>
        </label>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 14px',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            fontSize: 13, color: '#dc2626', fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={onSign}
          disabled={loading}
          style={{
            display: 'block', width: '100%',
            background: loading ? '#374151' : '#0f172a',
            border: 'none', borderRadius: 8,
            padding: '14px 0', fontSize: 15, fontWeight: 700, color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.2px', transition: 'background 0.15s',
          }}
        >
          {loading ? 'Signing…' : 'Sign Document'}
        </button>

        <p style={{ margin: '12px 0 0', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          Your signature, IP address, and timestamp are recorded as part of this electronic signature.
        </p>
      </div>
    </div>
  )
}
