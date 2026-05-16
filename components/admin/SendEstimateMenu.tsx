'use client'

import { useState } from 'react'
import { ArrowRight, ChevronDown, Copy, Eye, FileText, Loader2, Mail, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'

type SendEstimateMenuProps = {
  opportunity: {
    id: string
    opportunityNumber: string
    estimateTotal: number
    depositAmount?: number | null
    moveSize?: string | null
    moveDate?: string | null
    customer?: {
      id: string
      fullName: string
      email: string | null
      phone: string | null
    } | null
  }
}

const PRICING_OPTIONS = [
  { value: 'estimated_price', label: 'Estimated Price' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'summary', label: 'Summary' },
]

function defaultDeposit(total: number) {
  if (total > 0) return Math.min(500, Math.max(250, Math.round(total * 0.1)))
  return 250
}

export default function SendEstimateMenu({ opportunity }: SendEstimateMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pricingDisplay, setPricingDisplay] = useState('estimated_price')
  const [depositAmount, setDepositAmount] = useState(String(opportunity.depositAmount ?? defaultDeposit(opportunity.estimateTotal)))
  const [sendEmailChecked, setSendEmailChecked] = useState(Boolean(opportunity.customer?.email))
  const [sendSmsChecked, setSendSmsChecked] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function openPreview() {
    setLoading(true)
    try {
      const res = await fetch('/api/estimates/portal-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: opportunity.id, preview: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Unable to create portal preview')
        return
      }
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Unable to create portal preview')
    } finally {
      setLoading(false)
      setMenuOpen(false)
    }
  }

  async function sendEmail() {
    if (!sendEmailChecked || !opportunity.customer?.email) {
      toast.error('Select a customer email recipient')
      return
    }
    const deposit = Number(depositAmount)
    if (!Number.isFinite(deposit) || deposit < 0) {
      toast.error('Enter a valid deposit amount')
      return
    }

    setLoading(true)
    toast.message('Sending estimate email...')
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
      if (!res.ok) {
        toast.error(data.error ?? 'Unable to send estimate email')
        return
      }
      toast.success('Estimate email sent.')
      setDrawerOpen(false)
    } catch {
      toast.error('Unable to send estimate email')
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
        onClick={() => setMenuOpen(open => !open)}
        className="ml-1 inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-600 hover:bg-slate-50"
        aria-label="Estimate actions"
      >
        <ChevronDown size={16} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <button onClick={() => { setDrawerOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
            <Mail size={14} /> Send Estimate
          </button>
          <button onClick={openPreview} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview Estimate
          </button>
          <button onClick={() => placeholder('Book')} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
            <ArrowRight size={14} /> Book
          </button>
          <button onClick={() => placeholder('Mark Lost')} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
            <X size={14} /> Mark Lost
          </button>
          <button onClick={() => placeholder('Send Invoice')} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
            <FileText size={14} /> Send Invoice
          </button>
          <button onClick={() => placeholder('Duplicate Opportunity')} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
            <Copy size={14} /> Duplicate Opportunity
          </button>
        </div>
      )}

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
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pricing Display</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {PRICING_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setPricingDisplay(option.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${pricingDisplay === option.value ? 'border-kratos bg-kratos/10 text-slate-950' : 'border-slate-200 text-slate-600'}`}
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
                      onChange={event => setDepositAmount(event.target.value)}
                      inputMode="decimal"
                      className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none"
                    />
                  </div>
                </label>
              </section>

              <section className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Send estimate to</h3>
                <label className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                  <input type="checkbox" checked={sendEmailChecked} onChange={event => setSendEmailChecked(event.target.checked)} className="mt-1" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Customer email</span>
                    <span className="block text-sm text-slate-500">{opportunity.customer?.email ?? 'No email on file'}</span>
                  </span>
                </label>
                <label className="mt-2 flex items-start gap-3 rounded-xl border border-slate-200 p-3 opacity-60">
                  <input type="checkbox" checked={sendSmsChecked} onChange={event => setSendSmsChecked(event.target.checked)} disabled className="mt-1" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Customer phone</span>
                    <span className="block text-sm text-slate-500">{opportunity.customer?.phone ?? 'No phone on file'}</span>
                    <span className="mt-1 block text-xs text-amber-700">SMS estimate sending is not connected yet.</span>
                  </span>
                </label>
              </section>

              <section className="mt-6">
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Optional message
                  <textarea
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    rows={4}
                    placeholder="Leave blank to use the default estimate email template."
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-kratos"
                  />
                </label>
              </section>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="grid gap-2">
                <button onClick={openPreview} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                  Preview customer portal
                </button>
                <button onClick={sendEmail} disabled={loading || !sendEmailChecked || !opportunity.customer?.email} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kratos px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Send Email
                </button>
                <button onClick={() => toast.message('SMS estimate sending is not connected yet.')} disabled className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400">
                  Send SMS
                </button>
                <button onClick={() => setDrawerOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500">
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
