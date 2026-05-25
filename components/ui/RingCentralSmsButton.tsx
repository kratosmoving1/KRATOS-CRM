'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type RingCentralSmsButtonProps = {
  phoneNumber: string
  customerId: string
  opportunityId?: string | null
  label?: string
  className?: string
  iconOnly?: boolean
}

export default function RingCentralSmsButton({
  phoneNumber,
  customerId,
  opportunityId = null,
  label = 'Text',
  className,
  iconOnly = false,
}: RingCentralSmsButtonProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function sendSms() {
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error('Message content required')
      return
    }

    setSending(true)
    toast.message('Sending SMS...')

    try {
      const res = await fetch('/api/communications/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          opportunityId,
          toPhoneNumber: phoneNumber,
          messageBody: trimmed,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(typeof data?.error === 'string' ? data.error : 'Unable to send SMS')
        return
      }

      toast.success('SMS sent.')
      setMessage('')
      setOpen(false)
    } catch {
      toast.error('Unable to send SMS')
    } finally {
      setSending(false)
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={event => {
          event.stopPropagation()
          setOpen(true)
        }}
        className={cn('inline-flex items-center gap-1 text-blue-600 hover:underline', className)}
        aria-label={iconOnly ? `Text ${phoneNumber}` : undefined}
      >
        <MessageSquare size={iconOnly ? 16 : 14} />
        {!iconOnly && <span>{label}</span>}
      </button>

      {open && (
        <span
          role="dialog"
          aria-label="Send customer SMS"
          className="fixed left-1/2 top-1/2 z-[100] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-slate-900">Send text message</span>
              <span className="mt-1 block text-sm text-slate-600">{phoneNumber}</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cancel SMS"
            >
              <X size={16} />
            </button>
          </span>
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            rows={5}
            placeholder="Type message..."
            className="mt-4 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
          />
          <span className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={sendSms}
              disabled={sending || !message.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-kratos px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send
            </button>
          </span>
        </span>
      )}
    </span>
  )
}
