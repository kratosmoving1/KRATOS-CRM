'use client'

import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { MOVE_SIZE_LABELS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

interface EstimateData {
  opportunityNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  serviceDate: string | null
  serviceType: string
  moveSize: string | null
  totalAmount: number
  depositAmount: number | null
  originAddress: string
  destAddress: string
  notes: string | null
  alreadySigned: boolean
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'To be confirmed'
  return new Date(value).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function SignEstimatePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [data, setData] = useState<EstimateData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [signedName, setSignedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    fetch(`/api/estimates/portal-data?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setLoadError(json.error); return }
        setData(json)
      })
      .catch(() => setLoadError('Failed to load estimate'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSign() {
    if (!signedName.trim()) { setSubmitError('Please enter your full name'); return }
    if (!agreed) { setSubmitError('Please agree to the estimate terms'); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/estimates/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signedName: signedName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setSubmitError(json.error ?? 'Failed to sign estimate'); return }
      setSigned(true)
    } catch {
      setSubmitError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-kratos" />
      </main>
    )
  }

  if (loadError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Estimate unavailable</h1>
          <p className="mt-2 text-sm text-slate-300">{loadError ?? 'Please contact Kratos Moving at (800) 321-3222.'}</p>
        </div>
      </main>
    )
  }

  if (signed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Estimate Signed!</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Thank you, {signedName}. Your estimate has been accepted. A Kratos Moving coordinator will be in touch shortly to confirm your booking.
        </p>
        <p className="mt-4 text-sm text-slate-400">Questions? Call us at (800) 321-3222.</p>
        <button
          onClick={() => router.push(`/portal/estimate/${token}`)}
          className="mt-8 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white"
        >
          View Estimate
        </button>
      </main>
    )
  }

  const moveSize = data.moveSize ? (MOVE_SIZE_LABELS[data.moveSize] ?? data.moveSize.replace(/_/g, ' ')) : 'To be confirmed'
  const subtotal = Number(data.totalAmount ?? 0)
  const deposit = Number(data.depositAmount ?? 0)

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <button
            onClick={() => router.push(`/portal/estimate/${token}`)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} /> View Estimate
          </button>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-kratos/10 px-2.5 py-1 text-xs font-semibold text-slate-800">0 of 1 completed</span>
          </div>
          <button
            onClick={handleSign}
            disabled={submitting || !agreed || !signedName.trim()}
            className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Sign Estimate
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pt-8">
        {/* Estimate document */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6 md:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <Image src="/logo.png" alt="Kratos Moving" width={48} height={48} className="object-contain" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Estimate for Moving Services</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Estimate #{data.opportunityNumber}
                </h1>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p className="font-semibold text-slate-900">{data.customerName}</p>
                {data.customerEmail && <p>{data.customerEmail}</p>}
                {data.customerPhone && <p>{data.customerPhone}</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-b border-slate-200 p-6 md:grid-cols-2 md:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Origin</p>
              <p className="mt-1 text-sm text-slate-700">{data.originAddress || 'To be confirmed'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Destination</p>
              <p className="mt-1 text-sm text-slate-700">{data.destAddress || 'To be confirmed'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Move Date</p>
              <p className="mt-1 text-sm text-slate-700">{dateLabel(data.serviceDate)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Move Size</p>
              <p className="mt-1 text-sm text-slate-700">{moveSize}</p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Service</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-medium text-slate-900">
                    {String(data.serviceType ?? 'Moving').replace(/_/g, ' ')} — {moveSize}
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-900">{formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td className="py-3 text-slate-500">HST</td>
                  <td className="py-3 text-right text-slate-500">Included</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="pt-4 font-bold text-slate-900">Estimated Total</td>
                  <td className="pt-4 text-right text-xl font-bold text-slate-900">{formatCurrency(subtotal)}</td>
                </tr>
                {deposit > 0 && (
                  <tr>
                    <td className="pt-2 text-slate-500">Deposit to secure move</td>
                    <td className="pt-2 text-right font-semibold text-kratos">{formatCurrency(deposit)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {data.notes && (
            <div className="border-t border-slate-200 p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Notes</p>
              <p className="mt-2 text-sm text-slate-600">{data.notes}</p>
            </div>
          )}

          <div className="border-t border-slate-200 bg-slate-50 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Terms & Conditions</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              By signing this estimate, I acknowledge that I have reviewed the services listed above and agree to the
              estimated pricing. This estimate is not a guaranteed price — actual charges may vary based on time,
              materials, and additional services requested on moving day. A deposit of {deposit > 0 ? formatCurrency(deposit) : 'the agreed amount'} is
              required to secure the booking date. Cancellation must be made at least 72 hours in advance to receive a
              full deposit refund. Kratos Moving Inc. is not responsible for items not properly packed or disclosed
              prior to moving day.
            </p>
          </div>
        </div>

        {/* Signature section */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Sign Estimate</h2>
          <p className="mt-1 text-sm text-slate-500">
            Type your full name below to electronically sign this estimate.
          </p>

          <div className="mt-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Full Name
            </label>
            <input
              type="text"
              value={signedName}
              onChange={e => setSignedName(e.target.value)}
              placeholder="Jane Smith"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-kratos focus:ring-2 focus:ring-kratos/20"
              autoComplete="name"
            />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-kratos"
            />
            <span className="text-sm text-slate-600">
              I have read and agree to the estimate terms and conditions above.
            </span>
          </label>

          {submitError && (
            <p className="mt-3 text-sm font-medium text-red-600">{submitError}</p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleSign}
              disabled={submitting || !agreed || !signedName.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Accept &amp; Sign Estimate
            </button>
            <button
              onClick={() => router.push(`/portal/estimate/${token}`)}
              className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Back to Estimate
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
