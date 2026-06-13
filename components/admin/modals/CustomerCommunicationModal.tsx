'use client'

import { useState } from 'react'
import { X, CheckCircle2, Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  customerName: string | null
  customerEmail: string | null
  isOpen: boolean
  onClose: () => void
  onSendInvoice: () => void
}

export default function CustomerCommunicationModal({
  customerName,
  customerEmail,
  isOpen,
  onClose,
  onSendInvoice,
}: Props) {
  const [sendInvoice, setSendInvoice] = useState(true)
  const [sending, setSending] = useState(false)

  async function handleConfirm() {
    if (!sendInvoice) { onClose(); return }
    if (!customerEmail) {
      toast.error('No email address on file — cannot send invoice.')
      return
    }
    setSending(true)
    try {
      onSendInvoice()
    } finally {
      setSending(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-emerald-600 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={18} className="text-white" />
                <h2 className="text-base font-bold text-white">Job Finalized</h2>
              </div>
              <p className="text-sm text-emerald-100">
                {customerName ? `${customerName}'s` : 'The'} job has been marked as completed.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-emerald-200 hover:text-white hover:bg-emerald-700">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Notify the customer?</p>

          <div className="space-y-3">
            {/* Invoice checkbox */}
            <label className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
              sendInvoice ? 'border-kratos bg-amber-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={sendInvoice}
                onChange={e => setSendInvoice(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-kratos flex-shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">Email invoice</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {customerEmail
                    ? `Send invoice to ${customerEmail}`
                    : 'No email on file — cannot send'}
                </p>
              </div>
            </label>

            {/* Review request — stub */}
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 opacity-50 cursor-not-allowed">
              <input type="checkbox" disabled className="mt-0.5 h-4 w-4 rounded border-slate-300 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  Send review request
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Coming soon</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Google review link via email or SMS</p>
              </div>
            </label>
          </div>

          {!customerEmail && sendInvoice && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <Mail size={12} /> No email address on file — invoice cannot be sent.
              </p>
              <p className="text-xs text-amber-600 mt-1">Add an email to this customer to enable email notifications.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Skip
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {sending && <Loader2 size={13} className="animate-spin" />}
            {sendInvoice && customerEmail ? 'Send & Close' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
