'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X, FileText, MoreHorizontal, Eye, Send,
  Loader2, RefreshCw, CheckCircle2, Copy, Link,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS } from '@/lib/documents/merge-fields'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentRow {
  id: string
  name: string
  category: string
  status: 'not_started' | 'generated' | 'sent' | 'viewed' | 'signed' | 'completed'
  rendered_html: string | null
  rendered_at: string | null
  sent_at: string | null
  sent_to: string | null
  document_number: string | null
  created_at: string
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  generated:   'bg-blue-100 text-blue-700',
  sent:        'bg-amber-100 text-amber-800',
  viewed:      'bg-purple-100 text-purple-700',
  signed:      'bg-green-100 text-green-700',
  completed:   'bg-emerald-100 text-emerald-800',
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  generated:   'Generated',
  sent:        'Sent',
  viewed:      'Viewed',
  signed:      'Signed',
  completed:   'Completed',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
      STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-500',
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── Row menu ──────────────────────────────────────────────────────────────────

function DocRowMenu({
  doc,
  onPreview,
  onSend,
  onMarkSigned,
}: {
  doc: DocumentRow
  onPreview: () => void
  onSend: () => void
  onMarkSigned: () => void
}) {
  const [open, setOpen] = useState(false)
  const isContract = doc.category === 'job_contract'
  const alreadySent = ['sent', 'viewed', 'signed', 'completed'].includes(doc.status)
  const isSigned = ['signed', 'completed'].includes(doc.status)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <button
              type="button"
              onClick={() => { setOpen(false); onPreview() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Eye size={13} /> Preview
            </button>
            {!isSigned && (
              <button
                type="button"
                onClick={() => { setOpen(false); onSend() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Send size={13} />
                {alreadySent ? 'Resend to Customer' : 'Send Signature Request'}
              </button>
            )}
            {isContract && alreadySent && !isSigned && (
              <button
                type="button"
                onClick={() => { setOpen(false); onMarkSigned() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-green-50"
              >
                <CheckCircle2 size={13} /> Mark as Signed
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  opportunityId: string
  quoteNumber: string
  isOpen: boolean
  onClose: () => void
  onCountChange?: (n: number) => void
  onPreviewDoc?: (doc: DocumentRow) => void
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DocsSidePanel({
  opportunityId,
  quoteNumber,
  isOpen,
  onClose,
  onCountChange,
  onPreviewDoc,
}: Props) {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [portalLink, setPortalLink] = useState<{ docName: string; url: string } | null>(null)
  const autoGenerateAttempted = useRef(false)

  const fetchDocs = useCallback(async () => {
    if (!opportunityId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}/documents`)
      if (!res.ok) return
      const data: DocumentRow[] = await res.json()

      if (data.length > 0) {
        setDocs(data)
        onCountChange?.(data.length)
        return
      }

      // Auto-generate on first open if no docs exist
      if (autoGenerateAttempted.current) return
      autoGenerateAttempted.current = true

      const genRes = await fetch(`/api/admin/opportunities/${opportunityId}/documents/generate`, { method: 'POST' })
      if (genRes.ok) {
        const genData = await genRes.json()
        const generated: DocumentRow[] = genData.documents ?? []
        setDocs(generated)
        onCountChange?.(generated.length)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [opportunityId, onCountChange])

  useEffect(() => {
    if (isOpen) fetchDocs()
  }, [isOpen, fetchDocs])

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}/documents/generate`, {
        method: 'POST',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Regenerate failed')
        return
      }
      await fetchDocs()
      toast.success('Documents regenerated.')
    } catch {
      toast.error('Network error')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleSend(doc: DocumentRow) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/send`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Failed to send'); return }
      await fetchDocs()
      if (j.emailSent) {
        toast.success(`Email sent to ${j.sentTo}`)
      } else {
        // Email not configured — show the portal link so admin can share manually
        setPortalLink({ docName: doc.name, url: j.portalUrl })
      }
    } catch {
      toast.error('Network error — please try again')
    }
  }

  async function handleMarkSigned(doc: DocumentRow) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'signed' }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Failed to update'); return }
      toast.success('Contract marked as signed.')
      await fetchDocs()
    } catch {
      toast.error('Network error')
    }
  }

  async function handleDelete(doc: DocumentRow) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Delete failed')
        return
      }
      await fetchDocs()
      toast.success('Document removed.')
    } catch {
      toast.error('Network error')
    }
  }

  // Group docs by Opportunity vs Job
  const opportunityDocs = docs.filter(d => d.category.startsWith('opportunity_'))
  const jobDocs = docs.filter(d => d.category.startsWith('job_'))

  if (!isOpen) return null

  return (
    <>
      {/* Portal link modal — shown when email isn't configured */}
      {portalLink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPortalLink(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Link size={18} className="text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Share Portal Link</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Email sending is not configured. Copy this link and send it to the customer directly (email, SMS, WhatsApp, etc).
                </p>
              </div>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{portalLink.docName}</p>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="flex-1 truncate text-sm text-slate-700 font-mono">{portalLink.url}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(portalLink.url)
                  toast.success('Link copied!')
                }}
                className="shrink-0 rounded-md bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              The document has been saved and is ready for the customer to view and sign at this link.
            </p>
            <button
              type="button"
              onClick={() => setPortalLink(null)}
              className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Documents</h2>
            <p className="text-xs text-slate-500 mt-0.5">Quote {quoteNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-400 px-1">
              <Loader2 className="animate-spin" size={16} />
              Preparing documents…
            </div>
          ) : docs.length === 0 ? (
            <p className="py-8 text-sm text-slate-400 px-1">No published templates found. Go to Settings → Documents to publish templates.</p>
          ) : (
            <>
              {/* Opportunity group */}
              {opportunityDocs.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Opportunity</p>
                  <div className="space-y-2">
                    {opportunityDocs.map(doc => (
                      <DocCard
                        key={doc.id}
                        doc={doc}
                        onPreview={() => onPreviewDoc?.(doc)}
                        onSend={() => handleSend(doc)}
                        onMarkSigned={() => handleMarkSigned(doc)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Job group */}
              {jobDocs.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Job</p>
                  <div className="space-y-2">
                    {jobDocs.map(doc => (
                      <DocCard
                        key={doc.id}
                        doc={doc}
                        onPreview={() => onPreviewDoc?.(doc)}
                        onSend={() => handleSend(doc)}
                        onMarkSigned={() => handleMarkSigned(doc)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {docs.length > 0 && (
          <div className="border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {regenerating
                ? <Loader2 size={14} className="animate-spin" />
                : <RefreshCw size={14} />}
              {regenerating ? 'Regenerating...' : 'Regenerate Documents'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Doc card row ──────────────────────────────────────────────────────────────

function DocCard({
  doc,
  onPreview,
  onSend,
  onMarkSigned,
}: {
  doc: DocumentRow
  onPreview: () => void
  onSend: () => void
  onMarkSigned: () => void
}) {
  const isContract = doc.category === 'job_contract'
  const isSigned   = ['signed', 'completed'].includes(doc.status)
  const alreadySent = ['sent', 'viewed', 'signed', 'completed'].includes(doc.status)

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className={cn(
      'rounded-lg border bg-white px-3 py-2.5 transition-colors',
      isContract
        ? isSigned
          ? 'border-green-200 bg-green-50'
          : alreadySent
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 hover:bg-slate-50'
        : 'border-slate-200 hover:bg-slate-50',
    )}>
      <div className="flex items-center gap-3">
        <FileText size={16} className={cn('shrink-0', isSigned ? 'text-green-500' : 'text-slate-400')} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onPreview}
            className="block truncate text-sm font-medium text-slate-800 hover:text-kratos text-left w-full"
          >
            {doc.name}
          </button>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {CATEGORY_LABELS[doc.category] ?? doc.category}
          </p>
          {isContract && isSigned && (
            <p className="text-[10px] font-semibold text-green-700 mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={10} /> Signed
            </p>
          )}
          {isContract && alreadySent && !isSigned && doc.sent_at && (
            <p className="text-[10px] text-amber-700 mt-0.5">
              Sent {fmtDate(doc.sent_at)}{doc.sent_to ? ` → ${doc.sent_to}` : ''}
            </p>
          )}
        </div>
        <StatusPill status={doc.status} />
        <DocRowMenu
          doc={doc}
          onPreview={onPreview}
          onSend={onSend}
          onMarkSigned={onMarkSigned}
        />
      </div>
      {/* Contract-specific action row */}
      {isContract && !isSigned && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={onSend}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3 py-1.5 text-[11px] font-bold text-white uppercase tracking-wide hover:bg-slate-800 transition-colors"
          >
            <Send size={11} />
            {alreadySent ? 'Resend to Customer' : 'Send for Signature'}
          </button>
          {alreadySent && (
            <button
              type="button"
              onClick={onMarkSigned}
              className="flex items-center gap-1.5 rounded-md border border-green-300 px-3 py-1.5 text-[11px] font-bold text-green-700 uppercase tracking-wide hover:bg-green-50 transition-colors"
            >
              <CheckCircle2 size={11} /> Signed
            </button>
          )}
        </div>
      )}
    </div>
  )
}
