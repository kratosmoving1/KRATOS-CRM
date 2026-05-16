'use client'

import { useState } from 'react'
import { Loader2, Phone, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type RingCentralCallButtonProps = {
  phoneNumber: string
  label?: string
  opportunityId?: string | null
  customerId?: string | null
  className?: string
}

export default function RingCentralCallButton({
  phoneNumber,
  label = phoneNumber,
  opportunityId = null,
  customerId = null,
  className,
}: RingCentralCallButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [calling, setCalling] = useState(false)

  async function callNow() {
    setCalling(true)
    toast.message('Calling customer...')

    try {
      const res = await fetch('/api/ringcentral/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId, customerId, phoneNumber }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        toast.success('Call started through RingCentral.')
        setConfirming(false)
        return
      }

      if (typeof data?.error === 'string') {
        toast.error(data.error)
        return
      }

      toast.error('Unable to start call.')
    } catch {
      toast.error('Unable to start call.')
    } finally {
      setCalling(false)
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={event => {
          event.stopPropagation()
          setConfirming(true)
        }}
        className={cn('inline-flex items-center gap-1 text-blue-600 hover:underline', className)}
      >
        {label}
      </button>

      {confirming && (
        <span
          role="dialog"
          aria-label="Confirm RingCentral call"
          className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl"
          onClick={event => event.stopPropagation()}
        >
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-slate-900">Call customer through RingCentral?</span>
              <span className="mt-1 block text-sm text-slate-600">{label}</span>
            </span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cancel RingCentral call"
            >
              <X size={16} />
            </button>
          </span>
          <span className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={callNow}
              disabled={calling}
              className="inline-flex items-center gap-2 rounded-lg bg-kratos px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {calling ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
              Call Now
            </button>
          </span>
        </span>
      )}
    </span>
  )
}
