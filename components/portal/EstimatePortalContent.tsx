'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Minus, Plus, Shield, X } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { PORTAL_MATERIALS, type PortalMaterial } from '@/lib/portal/materials'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import { TARIFF_PACKAGES } from '@/lib/tariff/packages'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PortalCharge {
  name: string
  charge_type: string
  subtotal: number
  discount_amount: number
  total: number
  config: Record<string, unknown>
}

export interface PortalPageData {
  opp: {
    id: string
    opportunity_number: string
    status: string
    service_type: string
    service_date: string | null
    move_size: string | null
    deposit_amount: number | null
    origin_address_line1: string | null
    origin_city: string | null
    origin_province: string | null
    dest_address_line1: string | null
    dest_city: string | null
    dest_province: string | null
  }
  customer: { full_name: string; email: string | null; phone: string | null } | null
  charges: PortalCharge[]
  subtotal: number
  discounts: number
  hst: number
  total: number
  deposit: number
  moveSize: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateLabel(value: string | null | undefined) {
  if (!value) return 'To be confirmed'
  return new Date(value).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function addr(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(', ') || 'To be confirmed'
}

function packageDisplayName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Moving Package'
  return /package$/i.test(trimmed) ? trimmed : `${trimmed} Package`
}

const PROTECTION_OPTIONS = [
  {
    id: 'basic',
    name: 'Basic Released Value Protection',
    description: 'Included with every Kratos Moving job. Coverage is $0.60/lb per article per federal regulations.',
    badge: 'Included — Free',
    color: 'border-green-200 bg-green-50',
    badgeColor: 'bg-green-100 text-green-700',
  },
  {
    id: 'full_value',
    name: 'Full Value Protection',
    description: 'Enhanced coverage based on declared total value. Request a quote — subject to approval and eligibility.',
    badge: 'Request pricing',
    color: 'border-slate-200 bg-white',
    badgeColor: 'bg-slate-100 text-slate-700',
  },
] as const

type ProtectionId = typeof PROTECTION_OPTIONS[number]['id']

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  data: PortalPageData
  token: string
  isPreview: boolean
  alreadySigned: boolean
  paymentSucceeded: boolean
}

export default function EstimatePortalContent({ data, token, isPreview, alreadySigned, paymentSucceeded }: Props) {
  const { opp, customer, charges, subtotal, discounts, hst, total, deposit, moveSize } = data

  // Labor charge breakdown
  const laborCharge = charges.find(c => c.charge_type === 'moving_labor')
  const lc = laborCharge?.config ?? {}
  const packageName = packageDisplayName(String(lc.package_name ?? 'Moving Package'))
  const hourlyRate = Number(lc.hourly_rate ?? 0)
  const laborHours = Number(lc.labor_hours ?? 0)
  const billableHours = Number(lc.billable_hours ?? lc.labor_hours ?? 0)
  const travelHours = Number(lc.travel_hours ?? 0)
  const numTrucks = Number(lc.num_trucks ?? 1)
  const numCrew = Number(lc.num_crew ?? 2)
  const isGold = packageName.toLowerCase().includes('gold')
  const packageRateLabel = isGold
    ? `${formatCurrency(hourlyRate)}/hr${hourlyRate >= TARIFF_PACKAGES.gold.weekendRate ? ' peak' : ' weekday'}`
    : `${formatCurrency(hourlyRate)}/hr`
  const supplementaryCharges = charges.filter(c => c.charge_type !== 'moving_labor')

  // Materials state (client-side only for MVP)
  const [materialQty, setMaterialQty] = useState<Record<string, number>>({})
  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [protection, setProtection] = useState<ProtectionId>('basic')
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(alreadySigned || paymentSucceeded)

  const materialsSubtotal = useMemo(() => {
    return PORTAL_MATERIALS.reduce((sum, m) => sum + (materialQty[m.id] ?? 0) * m.unitPrice, 0)
  }, [materialQty])

  const grandTotal = total + materialsSubtotal
  const grandHst = hst + materialsSubtotal * 0.13

  function setQty(id: string, qty: number) {
    setMaterialQty(prev => ({ ...prev, [id]: Math.max(0, qty) }))
  }

  async function handleAcceptAndPay() {
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/portal/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, depositAmount: deposit }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        setCheckoutError(json.error ?? 'Unable to start payment. Please call (800) 321-3222.')
        return
      }
      window.location.href = json.url
    } catch {
      setCheckoutError('Network error. Please try again or call (800) 321-3222.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Auto-close modal when payment succeeds
  useEffect(() => {
    if (paymentSucceeded) setAccepted(true)
  }, [paymentSucceeded])

  return (
    <div className="min-h-screen bg-[#f8f8f8] pb-32 text-slate-950">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Kratos Moving" width={32} height={36} className="object-contain" />
            <div>
              <p className="text-xs font-bold leading-none text-kratos">Kratos Moving</p>
              <p className="mt-0.5 text-[10px] leading-none text-slate-400">(800) 321-3222</p>
            </div>
          </div>
          <Link
            href={`/portal/estimate/${token}/sign`}
            className="rounded-xl bg-kratos px-4 py-2 text-xs font-bold text-slate-950"
          >
            {accepted ? 'View Agreement' : 'Sign Estimate'}
          </Link>
        </div>
      </header>

      {/* ── Admin preview banner ─────────────────────────────────────────── */}
      {isPreview && (
        <div className="bg-amber-50 px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-amber-800">
          Admin preview — not visible to customers
        </div>
      )}

      {/* ── Payment success banner ───────────────────────────────────────── */}
      {paymentSucceeded && (
        <div className="border-b border-green-200 bg-green-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-green-800">Deposit received — your move date is secured!</p>
          <p className="mt-0.5 text-xs text-green-700">A Kratos Moving coordinator will be in touch to confirm your booking.</p>
        </div>
      )}

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-5">

        {/* ── Quote header ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-kratos">Your Moving Estimate</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Quote {formatQuoteNumber(opp.opportunity_number)}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {accepted ? 'Accepted' : 'Pending acceptance'}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {dateLabel(opp.service_date)}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 capitalize">
              {moveSize}
            </span>
          </div>
        </div>

        {/* ── Estimate summary card ─────────────────────────────────────────── */}
        <div className="rounded-2xl bg-slate-950 p-5 text-white">
          {laborCharge && hourlyRate > 0 ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Recommended package</p>
              <p className="mt-1 text-3xl font-bold text-kratos">{packageName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-200">{numTrucks} truck · {numCrew} movers</p>
              <p className="mt-3 text-xl font-bold text-white">{packageRateLabel}</p>
              {isGold && hourlyRate < TARIFF_PACKAGES.gold.weekendRate && (
                <p className="mt-1 text-xs text-slate-400">Peak/weekend Gold rate is {formatCurrency(TARIFF_PACKAGES.gold.weekendRate)}/hr when applicable.</p>
              )}
              <div className="mt-4 space-y-1.5 text-sm">
                {laborHours > 0 && <SummaryRow label="Estimated labour" value={`${laborHours}h`} />}
                {travelHours > 0 && <SummaryRow label="Estimated travel" value={`${travelHours}h`} />}
                {billableHours > 0 && <SummaryRow label="Total billable hours" value={`${billableHours}h`} bold />}
                <div className="my-2 border-t border-white/10" />
                {supplementaryCharges.map((c, i) => (
                  <SummaryRow key={i} label={c.name} value={formatCurrency(c.total)} />
                ))}
                {discounts > 0 && <SummaryRow label="Discounts" value={`− ${formatCurrency(discounts)}`} />}
                <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
                {materialsSubtotal > 0 && <SummaryRow label="Moving materials" value={formatCurrency(materialsSubtotal)} />}
                <SummaryRow label="HST (13%)" value={formatCurrency(grandHst)} />
                <div className="my-2 border-t border-white/10" />
                <SummaryRow label="Estimated total" value={formatCurrency(grandTotal)} bold large />
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Estimated Total</p>
              <p className="mt-2 text-4xl font-bold text-kratos">{formatCurrency(grandTotal)}</p>
              <div className="mt-4 space-y-1.5 text-sm">
                {supplementaryCharges.map((c, i) => <SummaryRow key={i} label={c.name} value={formatCurrency(c.total)} />)}
                {discounts > 0 && <SummaryRow label="Discounts" value={`− ${formatCurrency(discounts)}`} />}
                {materialsSubtotal > 0 && <SummaryRow label="Moving materials" value={formatCurrency(materialsSubtotal)} />}
                <SummaryRow label="HST (13%)" value={formatCurrency(grandHst)} />
              </div>
            </>
          )}
          <div className="mt-4 rounded-xl bg-white/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Deposit to secure move</span>
              <span className="text-sm font-bold text-kratos">{formatCurrency(deposit)}</span>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            Final total may vary based on actual time, inventory, access conditions, and selected add-ons.
          </p>
        </div>

        {/* ── Info cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCard title="Customer" body={customer?.full_name ?? 'Customer'} detail={customer?.phone ?? customer?.email ?? ''} />
          <InfoCard title="Support" body="Kratos Moving" detail="(800) 321-3222" />
          <InfoCard title="Origin" body={addr([opp.origin_address_line1, opp.origin_city, opp.origin_province])} />
          <InfoCard title="Destination" body={addr([opp.dest_address_line1, opp.dest_city, opp.dest_province])} />
        </div>

        {/* ── Charge breakdown ─────────────────────────────────────────────── */}
        {supplementaryCharges.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Estimate Breakdown</h2>
            <div className="mt-4 divide-y divide-slate-100 text-sm">
              {supplementaryCharges.map((c, i) => (
                <div key={i} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{c.name}</span>
                    <span className="shrink-0 font-semibold text-slate-900">{formatCurrency(c.total)}</span>
                  </div>
                  {c.discount_amount > 0 && (
                    <p className="mt-0.5 text-xs text-green-700">Discount applied: − {formatCurrency(c.discount_amount)}</p>
                  )}
                </div>
              ))}
              <div className="flex justify-between py-3 text-xs text-slate-500">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {discounts > 0 && (
                <div className="flex justify-between py-3 text-xs text-green-700">
                  <span>Discounts</span><span>− {formatCurrency(discounts)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 text-xs text-slate-500">
                <span>HST (13%)</span><span>{formatCurrency(hst)}</span>
              </div>
              <div className="flex justify-between py-3 font-bold">
                <span>Estimated Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Moving materials ─────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <button
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            onClick={() => setMaterialsOpen(o => !o)}
          >
            <div>
              <h2 className="text-sm font-bold text-slate-900">Moving Materials</h2>
              <p className="text-xs text-slate-500">
                {materialsSubtotal > 0
                  ? `${formatCurrency(materialsSubtotal)} in selected materials`
                  : 'Optional boxes, tape, and packing supplies'}
              </p>
            </div>
            {materialsOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>

          {materialsOpen && (
            <div className="border-t border-slate-100 px-5 pb-4">
              <div className="mt-4 space-y-4">
                {PORTAL_MATERIALS.map(m => (
                  <MaterialRow
                    key={m.id}
                    material={m}
                    qty={materialQty[m.id] ?? 0}
                    onChange={qty => setQty(m.id, qty)}
                  />
                ))}
              </div>
              {materialsSubtotal > 0 && (
                <div className="mt-4 flex justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold">
                  <span>Materials subtotal</span>
                  <span>{formatCurrency(materialsSubtotal)}</span>
                </div>
              )}
              <p className="mt-3 text-[10px] text-slate-400">Materials pricing does not include HST. Final invoice will reflect confirmed quantities on moving day.</p>
            </div>
          )}
        </section>

        {/* ── Protection options ───────────────────────────────────────────── */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900">Protection Options</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Select the level of protection for your belongings.
          </p>
          <div className="mt-4 space-y-3">
            {PROTECTION_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setProtection(opt.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  protection === opt.id ? 'border-kratos bg-kratos/5 ring-1 ring-kratos' : opt.color
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      protection === opt.id ? 'border-kratos' : 'border-slate-300'
                    }`}>
                      {protection === opt.id && <div className="h-2 w-2 rounded-full bg-kratos" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{opt.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{opt.description}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${opt.badgeColor}`}>
                    {opt.badge}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            Protection options may be subject to eligibility, declared value, and approval by Kratos Moving. Full Value Protection pricing will be provided upon request.
          </p>
        </section>

        {/* ── Inventory note ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">Manage your inventory to get the most accurate estimate.</p>
          <p className="mt-0.5 text-xs text-slate-500">Inventory changes after the estimate is sent may require a revised quote. Contact Kratos Moving if your inventory has changed significantly.</p>
        </div>

      </div>

      {/* ── Sticky footer ────────────────────────────────────────────────── */}
      {!accepted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Estimated total</p>
              <p className="text-lg font-bold text-slate-950">{formatCurrency(grandTotal)}</p>
              <p className="text-xs text-slate-500">Deposit today: <span className="font-semibold text-slate-800">{formatCurrency(deposit)}</span></p>
            </div>
            <button
              onClick={() => setShowAcceptModal(true)}
              className="rounded-xl bg-kratos px-6 py-3 text-sm font-bold text-slate-950 shadow-sm hover:opacity-90"
            >
              Accept Estimate
            </button>
          </div>
        </div>
      )}

      {accepted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-green-200 bg-green-50 px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="shrink-0 text-green-600" />
              <p className="text-sm font-semibold text-green-800">Estimate accepted — your move date is secured.</p>
            </div>
            <Link href={`/portal/estimate/${token}/sign`} className="shrink-0 text-xs font-semibold text-green-700 underline">
              View agreement
            </Link>
          </div>
        </div>
      )}

      {/* ── Accept modal ─────────────────────────────────────────────────── */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-950">Accept Your Moving Estimate</h2>
              <button onClick={() => { setShowAcceptModal(false); setCheckoutError(null) }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer</span>
                  <span className="font-semibold">{customer?.full_name ?? 'Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Move date</span>
                  <span className="font-semibold">{dateLabel(opp.service_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated total</span>
                  <span className="font-semibold">{formatCurrency(grandTotal)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Deposit due today</span>
                  <span className="font-bold text-kratos">{formatCurrency(deposit)}</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                By accepting, you confirm that you have reviewed the estimate details and understand the final total may vary based on actual time, services, inventory, and access conditions. A deposit of <strong>{formatCurrency(deposit)}</strong> is required to secure your move date.
              </p>

              {checkoutError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {checkoutError}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4">
              <button
                onClick={handleAcceptAndPay}
                disabled={checkoutLoading}
                className="flex items-center justify-center gap-2 rounded-xl bg-kratos px-5 py-3 text-sm font-bold text-slate-950 hover:opacity-90 disabled:opacity-60"
              >
                {checkoutLoading && <Loader2 size={15} className="animate-spin" />}
                Accept &amp; Pay Deposit — {formatCurrency(deposit)}
              </button>
              <button
                onClick={() => { setShowAcceptModal(false); setCheckoutError(null) }}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryRow({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={bold ? 'text-white' : 'text-slate-400'}>{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-semibold'} ${large ? 'text-xl text-kratos' : ''} text-white`}>
        {value}
      </span>
    </div>
  )
}

function InfoCard({ title, body, detail }: { title: string; body: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-900 leading-snug">{body}</p>
      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

function MaterialRow({ material, qty, onChange }: { material: PortalMaterial; qty: number; onChange: (qty: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{material.name}</p>
        <p className="text-xs text-slate-500">{material.description}</p>
        <p className="text-xs font-semibold text-slate-700">{formatCurrency(material.unitPrice)} each</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => onChange(qty - 1)}
          disabled={qty === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
        >
          <Minus size={14} />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
        <button
          onClick={() => onChange(qty + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <Plus size={14} />
        </button>
      </div>
      {qty > 0 && (
        <span className="w-16 text-right text-xs font-semibold text-slate-700 tabular-nums">
          {formatCurrency(qty * material.unitPrice)}
        </span>
      )}
    </div>
  )
}
