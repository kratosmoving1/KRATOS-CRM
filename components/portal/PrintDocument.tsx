'use client'

import { useEffect } from 'react'

interface Props {
  documentName: string
  documentNumber: string | null
  renderedHtml: string
  signerName: string | null
  signatureImage: string | null
  signedAt: string | null
}

export default function PrintDocument({
  renderedHtml,
  signerName,
  signatureImage,
  signedAt,
}: Props) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [])

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-CA', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  }

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
      `}</style>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 24px 40px' }}>
        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />

        {signerName && (
          <div style={{
            marginTop: 32, borderTop: '2px solid #e2e8f0', paddingTop: 20,
            pageBreakInside: 'avoid',
          }}>
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '14px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#16a34a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>&#10003;</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>Document Signed Electronically</div>
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 1 }}>
                  This signature is legally binding under the Electronic Commerce Act (Ontario).
                </div>
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#94a3b8', marginBottom: 8 }}>
              Electronic Signature Record
            </div>

            {signatureImage && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Drawn Signature</div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', display: 'inline-block', background: '#fafafa' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signatureImage} alt="Signature" style={{ maxWidth: 240, height: 70, objectFit: 'contain', display: 'block' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Signed by</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{signerName}</div>
              </div>
              {signedAt && (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Date &amp; time</div>
                  <div style={{ color: '#0f172a' }}>{fmtDate(signedAt)}</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
              Signature, IP address, and timestamp recorded by Kratos Moving Inc. Document management system.
              Kratos Moving Inc. &mdash; (800) 321-3222 &mdash; info@kratosmoving.ca
            </div>
          </div>
        )}

        <div className="no-print" style={{ marginTop: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
          If the print dialog did not open automatically,{' '}
          <button
            type="button"
            onClick={() => window.print()}
            style={{ color: '#0f172a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}
          >
            click here to print / save as PDF
          </button>
        </div>
      </div>
    </>
  )
}
