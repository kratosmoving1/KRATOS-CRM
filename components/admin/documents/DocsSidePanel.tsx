'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  X, FileText, MoreHorizontal, Trash2, Eye, Send,
  Loader2, RefreshCw, Plus,
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
  onMarkSent,
  onDelete,
}: {
  doc: DocumentRow
  onPreview: () => void
  onMarkSent: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
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
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <button
              type="button"
              onClick={() => { setOpen(false); onPreview() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Eye size={13} /> Preview
            </button>
            {doc.status === 'generated' && (
              <button
                type="button"
                onClick={() => { setOpen(false); onMarkSent() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Send size={13} /> Mark as Sent
              </button>
            )}
            <button
              type="button"
              onClick={() => { setOpen(false); onDelete() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={13} /> Delete
            </button>
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
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchDocs = useCallback(async () => {
    if (!opportunityId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}/documents`)
      if (res.ok) {
        const data: DocumentRow[] = await res.json()
        setDocs(data)
        onCountChange?.(data.length)
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

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}/documents/generate`, {
        method: 'POST',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Generate failed')
        return
      }
      await fetchDocs()
      toast.success('Documents generated.')
    } catch {
      toast.error('Network error')
    } finally {
      setGenerating(false)
    }
  }

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

  async function handleMarkSent(doc: DocumentRow) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Failed to mark as sent')
        return
      }
      await fetchDocs()
      toast.success('Marked as sent.')
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-slate-400" size={22} />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <FileText size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">No documents generated yet</p>
              <p className="mt-1 text-xs text-slate-400">Click Generate Documents to create documents from your published templates.</p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="mt-5 flex items-center gap-2 rounded-lg bg-kratos px-5 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {generating ? 'Generating...' : 'Generate Documents'}
              </button>
            </div>
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
                        onMarkSent={() => handleMarkSent(doc)}
                        onDelete={() => handleDelete(doc)}
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
                        onMarkSent={() => handleMarkSent(doc)}
                        onDelete={() => handleDelete(doc)}
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
  onMarkSent,
  onDelete,
}: {
  doc: DocumentRow
  onPreview: () => void
  onMarkSent: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50 transition-colors">
      <FileText size={16} className="shrink-0 text-slate-400" />
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
      </div>
      <StatusPill status={doc.status} />
      <DocRowMenu
        doc={doc}
        onPreview={onPreview}
        onMarkSent={onMarkSent}
        onDelete={onDelete}
      />
    </div>
  )
}
