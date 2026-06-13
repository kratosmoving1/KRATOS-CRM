'use client'

import { useEffect, useState } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DocumentRow } from './DocsSidePanel'

interface Props {
  doc: DocumentRow | null
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

export default function DocumentPreviewModal({ doc, isOpen, onClose, onRefresh }: Props) {
  const [livDoc, setLivDoc] = useState<DocumentRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!isOpen || !doc) { setLivDoc(null); return }
    setLoading(true)
    fetch(`/api/admin/documents/${doc.id}?fresh=true`)
      .then(r => r.json())
      .then(data => setLivDoc(data))
      .catch(() => setLivDoc(doc))
      .finally(() => setLoading(false))
  }, [isOpen, doc])

  if (!isOpen || !doc) return null

  const displayed = livDoc ?? doc
  const alreadySent = ['sent', 'viewed', 'signed', 'completed'].includes(displayed.status)

  async function handleSend() {
    if (!doc) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/send`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? 'Failed to send'); return }
      toast.success(`Sent to ${json.sentTo}`)
      onRefresh?.()
      onClose()
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">{doc.name}</h2>
            {doc.document_number && (
              <span className="text-xs text-slate-400 shrink-0">{doc.document_number}</span>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="ml-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-slate-400" size={22} />
            </div>
          ) : displayed.rendered_html ? (
            <div className="rounded-lg bg-white shadow-sm">
              <div
                className="prose prose-sm max-w-none p-6"
                dangerouslySetInnerHTML={{ __html: displayed.rendered_html }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              Document not yet rendered.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Close
          </button>
          {!alreadySent ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || loading}
              className="flex items-center gap-1.5 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {sending ? 'Sending…' : 'Send Signature Request'}
            </button>
          ) : (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Sent
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
