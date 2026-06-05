'use client'

import { useState } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DocumentRow } from './DocsSidePanel'

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

interface Props {
  doc: DocumentRow | null
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

export default function DocumentPreviewModal({ doc, isOpen, onClose, onRefresh }: Props) {
  const [markingSent, setMarkingSent] = useState(false)

  if (!isOpen || !doc) return null

  async function handleMarkSent() {
    if (!doc) return
    setMarkingSent(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Failed to update status')
        return
      }
      toast.success('Marked as sent.')
      onRefresh?.()
      onClose()
    } catch {
      toast.error('Network error')
    } finally {
      setMarkingSent(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">{doc.name}</h2>
            <span className={cn(
              'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
              STATUS_STYLES[doc.status] ?? 'bg-slate-100 text-slate-500',
            )}>
              {STATUS_LABELS[doc.status] ?? doc.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {doc.rendered_html ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: doc.rendered_html }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-slate-500">
                This document has not been generated yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Click Regenerate Documents in the panel to generate it.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <span className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
            STATUS_STYLES[doc.status] ?? 'bg-slate-100 text-slate-500',
          )}>
            Status: {STATUS_LABELS[doc.status] ?? doc.status}
          </span>
          <div className="flex items-center gap-2">
            {doc.status === 'generated' && (
              <button
                type="button"
                onClick={handleMarkSent}
                disabled={markingSent}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {markingSent ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Mark as Sent
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
