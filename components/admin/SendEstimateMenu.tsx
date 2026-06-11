'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ChevronDown, Copy, Eye, FileText, Loader2, Mail, MessageSquare, RotateCcw, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'

type OppStatus = 'opportunity' | 'booked' | 'completed' | 'closed' | 'cancelled'

type SendEstimateMenuProps = {
  opportunity: {
    id: string
    opportunityNumber: string
    estimateTotal: number
    depositAmount?: number | null
    moveSize?: string | null
    moveDate?: string | null
    status?: OppStatus | string | null
    customer?: {
      id: string
      fullName: string
      email: string | null
      phone: string | null
    } | null
  }
  onStatusChange?: (newStatus: OppStatus) => void
}

type SmsStatus = { canSend: boolean; provider: string; reason?: string }

const PRICING_OPTIONS = [
  { value: 'estimated_price', label: 'Estimated Price' },
  { value: 'hourly',          label: 'Hourly' },
  { value: 'detailed',        label: 'Detailed' },
  { value: 'summary',         label: 'Summary' },
]

export default function SendEstimateMenu({ opportunity, onStatusChange }: SendEstimateMenuProps) {
  const [menuOpen, setMenuOpen]     = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pricingDisplay, setPricingDisplay] = useState('estimated_price')
  const [depositAmount, setDepositAmount]   = useState(String(opportunity.depositAmount ?? 150))
  const [sendEmailChecked, setSendEmailChecked] = useState(Boolean(opportunity.customer?.email))
  const [sendSmsChecked, setSendSmsChecked]     = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null)

  // Modal state
  const [bookModalOpen,   setBookModalOpen]   = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [unbookModalOpen, setUnbookModalOpen] = useState(false)
  const [reopenModalOpen, setReopenModalOpen] = useState(false)

  // Per-modal options
  const [cancelReason,        setCancelReason]        = useState('')
  const [bookNotify,          setBookNotify]          = useState(true)
  const [cancelNotify,        setCancelNotify]        = useState(true)
  const [unbookNotify,        setUnbookNotify]        = useState(false)

  const currentStatus = (opportunity.status ?? 'opportunity') as OppStatus
  const hasEmail = Boolean(opportunity.customer?.email)
  const hasPhone = Boolean(opportunity.customer?.phone)
  const smsReady = Boolean(smsStatus?.canSend && hasPhone)

  const canBook   = currentStatus === 'opportunity'
  const canUnbook = currentStatus === 'booked'
  const canCancel = currentStatus === 'opportunity' || currentStatus === 'booked'
  const canReopen = currentStatus === 'cancelled'

  useEffect(() => {
    fetch('/api/admin/sms/status')
      .then(r => r.ok ? r.json() : null)
      .then((d: SmsStatus | null) => { if (d) setSmsStatus(d) })
      .catch(() => {})
  }, [])

  function smsLabel() {
    if (!hasPhone) return 'No customer phone on file'
    if (!smsStatus) return 'Checking SMS status…'
    if (smsStatus.canSend) return opportunity.customer?.phone ?? ''
    return smsStatus.reason ?? 'SMS not configured'
  }

  async function openPreview() {
    setLoading(true)
    setMenuOpen(false)
    try {
      const res = await fetch('/api/estimates/portal-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: opportunity.id, preview: true }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Unable to create portal preview'); return }
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create portal preview')
    } finally {
      setLoading(false)
    }
  }

  async function sendEstimateEmail() {
    if (!hasEmail || !opportunity.customer?.email) {
      toast.error('No customer email on file')
      return
    }
    const deposit = Number(depositAmount)
    if (!Number.isFinite(deposit) || deposit < 0) { toast.error('Enter a valid deposit amount'); return }

    setLoading(true)
    toast.message('Sending estimate email…')
    try {
      const res = await fetch('/api/estimates/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          recipientEmail: opportunity.customer.email,
          depositAmount: deposit,
          pricingDisplay,
          message: message.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Unable to send estimate email'); return }
      toast.success('Estimate email sent.')
      setDrawerOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to send estimate email')
    } finally {
      setLoading(false)
    }
  }

  async function sendSms() {
    if (!smsReady) return
    const deposit = Number(depositAmount)

    setLoading(true)
    toast.message('Sending estimate SMS…')
    try {
      const res = await fetch('/api/estimates/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          depositAmount: Number.isFinite(deposit) && deposit > 0 ? deposit : undefined,
          message: message.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Unable to send estimate SMS'); return }
      toast.success('Estimate SMS sent.')
      setDrawerOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to send estimate SMS')
    } finally {
      setLoading(false)
    }
  }

  async function changeStatus(newStatus: OppStatus, opts: { cancellationReason?: string; sendEmail?: boolean } = {}) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${opportunity.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatus,
          cancellationReason: opts.cancellationReason,
          sendEmail: opts.sendEmail !== false,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? `Unable to change status`); return }
      toast.success(
        newStatus === 'booked'      ? `Booked.${opts.sendEmail !== false ? ' Confirmation email sent.' : ''}` :
        newStatus === 'cancelled'   ? `Cancelled.${opts.sendEmail !== false ? ' Cancellation email sent.' : ''}` :
        newStatus === 'opportunity' && currentStatus === 'booked' ? 'Unbooked — moved back to Open.' :
        newStatus === 'opportunity' ? 'Reopened.' :
        `Status changed to ${newStatus}.`
      )
      onStatusChange?.(newStatus)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to change status')
    } finally {
      setLoading(false)
    }
  }

  function placeholder(label: string) {
    toast.message(`${label} is coming soon.`)
    setMenuOpen(false)
  }

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setDrawerOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-kratos px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90"
      >
        <Mail size={15} />
        Send Estimate
      </button>
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="ml-1 inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 hover:bg-slate-50"
        aria-label="Estimate actions"
      >
        <ChevronDown size={16} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <button onClick={() => { setDrawerOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
              <Mail size={14} /> Send Estimate
            </button>
            <button onClick={openPreview} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
              <Eye size={14} /> Preview Estimate
            </button>

            {(canBook || canUnbook || canCancel || canReopen) && (
              <div className="border-t border-slate-100" />
            )}

            {canBook && (
              <button
                onClick={() => { setMenuOpen(false); setBookModalOpen(true) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                <ArrowRight size={14} /> Book
              </button>
            )}
            {canUnbook && (
              <button
                onClick={() => { setMenuOpen(false); setUnbookModalOpen(true) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-amber-700 hover:bg-amber-50"
              >
                <Undo2 size={14} /> Unbook
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => { setMenuOpen(false); setCancelModalOpen(true) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <X size={14} /> Cancel
              </button>
            )}
            {canReopen && (
              <button
                onClick={() => { setMenuOpen(false); setReopenModalOpen(true) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50"
              >
                <RotateCcw size={14} /> Reopen
              </button>
            )}

            <div className="border-t border-slate-100" />
            <button onClick={() => placeholder('Send Invoice')} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
              <FileText size={14} /> Send Invoice
            </button>
            <button onClick={() => placeholder('Duplicate Quote')} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
              <Copy size={14} /> Duplicate Quote
            </button>
          </div>
        </>
      )}

      {/* Book modal */}
      {bookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setBookModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Book this opportunity?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Status will change to <strong>Booked</strong>.
            </p>
            {hasEmail && (
              <label className="mt-4 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookNotify}
                  onChange={e => setBookNotify(e.target.checked)}
                  className="accent-kratos h-4 w-4"
                />
                <span className="text-sm text-slate-700">
                  Send booking confirmation email to <strong>{opportunity.customer?.email}</strong>
                </span>
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setBookModalOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={async () => {
                  setBookModalOpen(false)
                  await changeStatus('booked', { sendEmail: bookNotify })
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unbook modal */}
      {unbookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setUnbookModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Unbook this opportunity?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Status will move back to <strong>Open</strong>.
            </p>
            {hasEmail && (
              <label className="mt-4 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unbookNotify}
                  onChange={e => setUnbookNotify(e.target.checked)}
                  className="accent-kratos h-4 w-4"
                />
                <span className="text-sm text-slate-700">
                  Notify customer by email
                </span>
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setUnbookModalOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={async () => {
                  setUnbookModalOpen(false)
                  await changeStatus('opportunity', { sendEmail: unbookNotify })
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Unbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setCancelModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Cancel this opportunity?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Status will change to <strong>Cancelled</strong>.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                Reason (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={3}
                placeholder="e.g. Customer requested cancellation"
                className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-red-400"
              />
            </div>
            {hasEmail && (
              <label className="mt-3 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelNotify}
                  onChange={e => setCancelNotify(e.target.checked)}
                  className="accent-kratos h-4 w-4"
                />
                <span className="text-sm text-slate-700">
                  Send cancellation email to <strong>{opportunity.customer?.email}</strong>
                </span>
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCancelModalOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Go Back
              </button>
              <button
                disabled={loading}
                onClick={async () => {
                  setCancelModalOpen(false)
                  await changeStatus('cancelled', {
                    cancellationReason: cancelReason.trim() || undefined,
                    sendEmail: cancelNotify,
                  })
                  setCancelReason('')
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen modal */}
      {reopenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setReopenModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Reopen this opportunity?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Status will move back to <strong>Open</strong>.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setReopenModalOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={async () => {
                  setReopenModalOpen(false)
                  await changeStatus('opportunity', { sendEmail: false })
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Estimate drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Send Estimate</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">Quote {opportunity.opportunityNumber}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatCurrency(opportunity.estimateTotal)} · {opportunity.moveSize ?? 'Move size TBD'} · {opportunity.moveDate ?? 'Date TBD'}
                  </p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Estimated price</p>
                    <p className="mt-1 text-2xl font-bold text-slate-950">{formatCurrency(opportunity.estimateTotal)}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 capitalize">
                    {pricingDisplay.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Move size</p>
                    <p className="mt-1 font-semibold text-slate-800">{opportunity.moveSize ?? 'TBD'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Move date</p>
                    <p className="mt-1 font-semibold text-slate-800">{opportunity.moveDate ?? 'TBD'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Customer</p>
                    <p className="mt-1 font-semibold text-slate-800">{opportunity.customer?.fullName ?? 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Pricing</p>
                    <p className="mt-1 font-semibold text-slate-800">Non-binding</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-500">Pricing Display</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {PRICING_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setPricingDisplay(option.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        pricingDisplay === option.value
                          ? 'border-kratos bg-kratos/10 text-slate-950'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Deposit Amount
                  <div className="mt-2 flex items-center rounded-xl border border-slate-200 px-3.5 py-2.5 focus-within:border-kratos">
                    <span className="mr-2 text-sm font-semibold text-slate-500">$</span>
                    <input
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      inputMode="decimal"
                      className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none"
                    />
                  </div>
                </label>
              </section>

              <section className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Send estimate to</h3>
                <label className={`mt-3 flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                  hasEmail ? 'border-slate-200 hover:border-slate-300' : 'border-slate-100 opacity-60'
                }`}>
                  <input
                    type="checkbox"
                    checked={sendEmailChecked}
                    onChange={e => setSendEmailChecked(e.target.checked)}
                    disabled={!hasEmail}
                    className="mt-1 accent-kratos"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <Mail size={13} className="text-slate-400" /> Customer email
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">
                      {hasEmail ? opportunity.customer!.email : 'No customer email on file'}
                    </span>
                  </span>
                </label>
                <label className={`mt-2 flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                  smsReady ? 'border-slate-200 hover:border-slate-300' : 'border-slate-100 opacity-60'
                }`}>
                  <input
                    type="checkbox"
                    checked={sendSmsChecked}
                    onChange={e => setSendSmsChecked(e.target.checked)}
                    disabled={!smsReady}
                    className="mt-1 accent-kratos"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <MessageSquare size={13} className="text-slate-400" /> Customer phone
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">{smsLabel()}</span>
                  </span>
                </label>
              </section>

              <section className="mt-6">
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Optional message
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Leave blank to use the default estimate template."
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-kratos"
                  />
                </label>
              </section>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="grid gap-2">
                <button
                  onClick={openPreview}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Preview customer portal
                </button>
                <button
                  onClick={sendEstimateEmail}
                  disabled={loading || !hasEmail || !sendEmailChecked}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-kratos px-4 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Send Email
                </button>
                <button
                  onClick={sendSms}
                  disabled={loading || !smsReady || !sendSmsChecked}
                  title={!smsReady ? smsLabel() : undefined}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Send SMS
                </button>
                <button onClick={() => setDrawerOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                  Cancel
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
