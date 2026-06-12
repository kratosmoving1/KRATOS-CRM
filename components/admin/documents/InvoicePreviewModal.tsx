'use client'

import { useEffect, useState } from 'react'
import { X, Send, Loader2, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  opportunityId: string
  customerEmail: string | undefined
  isOpen: boolean
  onClose: () => void
  onSent: () => void
}

export default function InvoicePreviewModal({ opportunityId, customerEmail, isOpen, onClose, onSent }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!isOpen) { setHtml(null); return }
    setLoading(true)
    fetch(`/api/admin/opportunities/${opportunityId}/send-invoice`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { toast.error(data.error); onClose(); return }
        setHtml(data.html ?? null)
        setSubject(data.subject ?? '')
        setRecipientEmail(data.customerEmail ?? customerEmail ?? '')
      })
      .catch(() => { toast.error('Failed to load invoice preview'); onClose() })
      .finally(() => setLoading(false))
  }, [isOpen, opportunityId, customerEmail, onClose])

  if (!isOpen) return null

  async function handleSend() {
    setSending(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunityId}/send-invoice`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error ?? 'Failed to send invoice'); return }
      toast.success(`Invoice sent to ${recipientEmail}`)
      onSent()
      onClose()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ReceiptText size={16} className="shrink-0 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">Invoice Preview</h2>
            </div>
            {subject && <p className="mt-0.5 truncate text-xs text-slate-400">{subject}</p>}
            {recipientEmail && (
              <p className="mt-0.5 text-xs text-slate-500">
                To: <span className="font-medium">{recipientEmail}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : html ? (
            <div className="rounded-lg overflow-hidden shadow">
              <iframe
                srcDoc={html}
                title="Invoice Preview"
                className="w-full bg-white"
                style={{ height: '560px', border: 'none' }}
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              No preview available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-xs text-slate-400">
            Review the invoice above before sending to the customer.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || loading || !html}
              className="flex items-center gap-1.5 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending...' : 'Send Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
