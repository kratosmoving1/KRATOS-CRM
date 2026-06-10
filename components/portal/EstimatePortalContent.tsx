'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  CheckCircle2, ChevronDown, ChevronUp, Download, Loader2,
  Minus, Phone, Plus, Shield, X,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { PORTAL_MATERIALS, type PortalMaterial } from '@/lib/portal/materials'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface PortalSettings {
  company_name: string
  company_phone: string
  logo_url: string | null
  header_notes: string | null
  footer_notes: string | null
  show_inventory_button: boolean
  show_download_button: boolean
  show_materials_section: boolean
  show_protection_section: boolean
  require_deposit: boolean
  allow_accept_without_deposit: boolean
  attachments: { id: string; name: string; file_url: string }[]
  badges: { id: string; name: string; image_url: string | null }[]
}

interface Props {
  data: PortalPageData
  token: string
  isPreview: boolean
  alreadySigned: boolean
  paymentSucceeded: boolean
  portalSettings: PortalSettings | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateLabel(value: string | null | undefined) {
  if (!value) return 'To be confirmed'
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function addr(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(', ') || 'To be confirmed'
}

function packageDisplayName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Moving Package'
  return /package$/i.test(trimmed) ? trimmed : `${trimmed} Package`
}

// Handles {{tag}} and {{ tag }} — spaces inside braces tolerated
function replaceMergeTags(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

// Render header notes with bold-orange customer name, orange "Accept Estimate", and styled dividers
function renderRichNotes(text: string, vars: Record<string, string>): React.ReactNode {
  // Mark customer_name before generic replacement so we can style it
  const marked = text.replace(/\{\{\s*customer_name\s*\}\}/gi, '\x00CNAME\x00')
  const replaced = replaceMergeTags(marked, vars)

  return replaced.split('\n').map((line, lineIdx) => {
    // Lines that look like a divider (——, --, or only dashes/unicode dashes)
    if (/^[-—–\s]{3,}$/.test(line.trim())) {
      return <div key={lineIdx} className="my-3 h-px bg-kratos opacity-60" />
    }
    if (line.trim() === '') {
      return <div key={lineIdx} className="h-2" />
    }

    // Split line on customer name marker and "Accept Estimate"
    const parts = line.split(/(\x00CNAME\x00|Accept Estimate)/g)
    return (
      <p key={lineIdx} className="leading-relaxed">
        {parts.map((part, i) => {
          if (part === '\x00CNAME\x00') {
            return <strong key={i} className="font-bold text-kratos">{vars.customer_name || 'Customer'}</strong>
          }
          if (part === 'Accept Estimate') {
            return <span key={i} className="font-semibold text-kratos">Accept Estimate</span>
          }
          return <span key={i}>{part}</span>
        })}
      </p>
    )
  })
}

const DEFAULT_PHONE   = '(800) 321-3222'
const DEFAULT_COMPANY = 'Kratos Moving Inc.'

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
type AcceptStep = 'idle' | 'confirm' | 'deposit'

// ── Main component ────────────────────────────────────────────────────────────

export default function EstimatePortalContent({
  data, token, isPreview, alreadySigned, paymentSucceeded, portalSettings,
}: Props) {
  const { opp, customer, charges, subtotal, discounts, hst, total, deposit, moveSize } = data

  const cfg           = portalSettings ?? null
  const companyName   = cfg?.company_name  ?? DEFAULT_COMPANY
  const companyPhone  = cfg?.company_phone ?? DEFAULT_PHONE
  const showInventory  = cfg?.show_inventory_button   ?? true
  const showDownload   = cfg?.show_download_button    ?? true
  const showMaterials  = cfg?.show_materials_section  ?? true
  const showProtection = cfg?.show_protection_section ?? true
  const allowSkipDeposit = cfg?.allow_accept_without_deposit ?? false

  const mergeVars: Record<string, string> = {
    customer_name:    customer?.full_name ?? '',
    quote_number:     formatQuoteNumber(opp.opportunity_number),
    move_date:        dateLabel(opp.service_date),
    company_phone:    companyPhone,
    origin_city:      opp.origin_city ?? '',
    destination_city: opp.dest_city ?? '',
  }

  // Labor charge breakdown
  const laborCharge   = charges.find(c => c.charge_type === 'moving_labor')
  const lc            = laborCharge?.config ?? {}
  const packageName   = packageDisplayName(String(lc.package_name ?? 'Moving Package'))
  const hourlyRate    = Number(lc.hourly_rate ?? 0)
  const laborHours    = Number(lc.labor_hours ?? 0)
  const billableHours = Number(lc.billable_hours ?? lc.labor_hours ?? 0)
  const travelHours   = Number(lc.travel_hours ?? 0)
  const numTrucks     = Number(lc.num_trucks ?? 1)
  const numCrew       = Number(lc.num_crew ?? 2)
  const supplementaryCharges = charges.filter(c => c.charge_type !== 'moving_labor')

  // Hero right-side info lines
  const heroInfoLines: string[] = []
  if (moveSize)     heroInfoLines.push(moveSize)
  if (laborHours > 0)  heroInfoLines.push(`${laborHours}h minimum`)
  if (numTrucks > 0 && numCrew > 0) {
    heroInfoLines.push(`Estimate for ${numTrucks} truck & ${numCrew} crew`)
  }
  heroInfoLines.push('Non-Binding Estimate')
  heroInfoLines.push('Released Value Protection')

  // Materials state
  const [materialQty, setMaterialQty] = useState<Record<string, number>>({})
  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [protection, setProtection] = useState<ProtectionId>('basic')

  // Accept flow state
  const [accepted, setAccepted] = useState(alreadySigned || paymentSucceeded)
  const [acceptStep, setAcceptStep] = useState<AcceptStep>('idle')
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const materialsSubtotal = useMemo(
    () => PORTAL_MATERIALS.reduce((sum, m) => sum + (materialQty[m.id] ?? 0) * m.unitPrice, 0),
    [materialQty],
  )
  const grandTotal = total + materialsSubtotal
  const grandHst   = hst + materialsSubtotal * 0.13

  function setQty(id: string, qty: number) {
    setMaterialQty(prev => ({ ...prev, [id]: Math.max(0, qty) }))
  }

  async function handleAccept() {
    setAcceptLoading(true)
    setAcceptError(null)
    try {
      const res = await fetch('/api/estimates/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setAcceptError(json.error ?? 'Unable to accept. Please try again.'); return }
      setAccepted(true)
      setAcceptStep('deposit')
    } catch {
      setAcceptError('Network error. Please try again.')
    } finally {
      setAcceptLoading(false)
    }
  }

  async function handlePayDeposit() {
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/portal/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, depositAmount: deposit }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) { setCheckoutError(json.error ?? 'Unable to start payment. Please call us.'); return }
      window.location.href = json.url
    } catch {
      setCheckoutError('Network error. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  function closeModal() {
    setAcceptStep('idle')
    setAcceptError(null)
    setCheckoutError(null)
  }

  return (
    <div className="min-h-screen bg-[#f0f0f0] pb-32 text-slate-950">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">

          {/* Left: phone with "Call us anytime" label */}
          <a
            href={`tel:${companyPhone.replace(/\D/g, '')}`}
            className="flex items-center gap-3 group"
          >
            <Phone size={18} className="text-slate-500 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 leading-none mb-0.5">Call us anytime</p>
              <p className="text-sm font-bold text-slate-900 leading-none group-hover:text-slate-700">
                {companyPhone}
              </p>
            </div>
          </a>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2">
            {showInventory && (
              <button className="hidden sm:block rounded px-5 py-2.5 bg-slate-950 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors">
                Manage Inventory
              </button>
            )}
            {showDownload && (
              <button className="hidden md:flex items-center gap-1.5 rounded px-5 py-2.5 bg-slate-950 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors">
                <Download size={12} /> Download
              </button>
            )}
            {!accepted ? (
              <button
                onClick={() => setAcceptStep('confirm')}
                className="rounded px-5 py-2.5 bg-slate-950 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors"
              >
                Accept Estimate
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded px-4 py-2.5 bg-green-700 text-white text-[11px] font-bold uppercase tracking-wider">
                <CheckCircle2 size={13} /> Accepted
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Admin preview banner ─────────────────────────────────────────────── */}
      {isPreview && (
        <div className="bg-amber-50 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-amber-700 border-b border-amber-100">
          Admin preview — not visible to customers
        </div>
      )}

      {/* ── Payment success banner ───────────────────────────────────────────── */}
      {paymentSucceeded && (
        <div className="border-b border-green-200 bg-green-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-green-800">Deposit received — your move date is secured!</p>
          <p className="mt-0.5 text-xs text-green-700">A Kratos Moving coordinator will be in touch to confirm your booking.</p>
        </div>
      )}

      {/* ── Dark hero ────────────────────────────────────────────────────────── */}
      <div className="bg-[#0a0a0a] text-white">
        <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
          <div className="flex items-start justify-between gap-8">

            {/* Left: logo + quote info */}
            <div className="flex-1 min-w-0">
              <Image
                src={cfg?.logo_url ?? '/logo.png'}
                alt={companyName}
                width={120}
                height={120}
                className="object-contain mb-6"
              />

              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-sm text-slate-400">
                  Estimate {formatQuoteNumber(opp.opportunity_number)}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  accepted ? 'bg-green-700 text-green-100' : 'bg-amber-700/80 text-amber-100'
                }`}>
                  {accepted ? 'Booked' : 'Not Booked'}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                Your Moving Estimate
              </h1>

              <p className="text-sm text-slate-400">Starting on: {dateLabel(opp.service_date)}</p>
              <p className="text-sm text-slate-400">Arrival window: TBD</p>
            </div>

            {/* Right: hourly rate + info lines */}
            {hourlyRate > 0 && (
              <div className="flex-shrink-0 text-right hidden sm:block">
                <p className="text-5xl font-bold text-white leading-none mb-3">
                  {formatCurrency(hourlyRate)}<span className="text-2xl text-slate-400 font-normal">/hour</span>
                </p>
                <div className="space-y-1">
                  {heroInfoLines.map((line, i) => (
                    <p key={i} className="text-sm text-slate-400">{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mobile: hourly rate below logo/title */}
          {hourlyRate > 0 && (
            <div className="mt-6 sm:hidden">
              <p className="text-4xl font-bold text-white">
                {formatCurrency(hourlyRate)}<span className="text-xl text-slate-400 font-normal">/hour</span>
              </p>
              <div className="mt-2 space-y-0.5">
                {heroInfoLines.map((line, i) => (
                  <p key={i} className="text-sm text-slate-400">{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-5 space-y-5 pb-6">

        {/* ── Info panel ───────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
            <InfoPanel
              title="Customer Support"
              lines={[companyName, companyPhone]}
            />
            <InfoPanel
              title="Your Info"
              lines={[
                customer?.full_name ?? '',
                customer?.email ?? '',
                customer?.phone ?? '',
              ]}
            />
            <InfoPanel
              title="Origin"
              lines={[
                opp.origin_address_line1 ?? '',
                addr([opp.origin_city, opp.origin_province]),
              ]}
            />
            <InfoPanel
              title="Destination"
              lines={[
                opp.dest_address_line1 ?? '',
                addr([opp.dest_city, opp.dest_province]),
              ]}
            />
          </div>
        </div>

        {/* ── Header notes (rich rendered) ─────────────────────────────────── */}
        {cfg?.header_notes && (
          <div className="rounded-lg bg-white px-6 py-6 shadow-sm text-sm text-slate-800">
            {renderRichNotes(cfg.header_notes, mergeVars)}
          </div>
        )}

        {/* ── Award/trust badges ───────────────────────────────────────────── */}
        {cfg?.badges && cfg.badges.length > 0 && (
          <div className="rounded-lg bg-white px-6 py-5 shadow-sm">
            <div className="flex items-center justify-center flex-wrap gap-5">
              {cfg.badges.map(badge => (
                badge.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={badge.id}
                    src={badge.image_url}
                    alt={badge.name}
                    className="h-16 w-auto object-contain"
                  />
                ) : (
                  <div key={badge.id} className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2">
                    <span className="text-xs font-semibold text-slate-700">{badge.name}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* ── Estimate breakdown ───────────────────────────────────────────── */}
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Estimate Breakdown</h2>
          <div className="space-y-1.5 text-sm">
            {laborCharge && hourlyRate > 0 ? (
              <>
                {laborHours > 0    && <SummaryRow label="Estimated labour"       value={`${laborHours}h`} />}
                {travelHours > 0   && <SummaryRow label="Estimated travel"       value={`${travelHours}h`} />}
                {billableHours > 0 && <SummaryRow label="Total billable hours"   value={`${billableHours}h`} bold />}
                {supplementaryCharges.length > 0 && <div className="border-t border-slate-100 my-2" />}
              </>
            ) : null}
            {supplementaryCharges.map((c, i) => (
              <div key={i}>
                <SummaryRow label={c.name} value={formatCurrency(c.total)} />
                {c.discount_amount > 0 && (
                  <p className="text-xs text-green-700 ml-2 mt-0.5">Discount: − {formatCurrency(c.discount_amount)}</p>
                )}
              </div>
            ))}
            <div className="border-t border-slate-100 mt-3 pt-3 space-y-1.5">
              <SummaryRow label="Subtotal"             value={formatCurrency(subtotal)} />
              {discounts > 0 && <SummaryRow label="Discounts"        value={`− ${formatCurrency(discounts)}`} />}
              {materialsSubtotal > 0 && <SummaryRow label="Moving materials" value={formatCurrency(materialsSubtotal)} />}
              <SummaryRow label="HST (13%)"            value={formatCurrency(grandHst)} />
              <div className="border-t border-slate-100 pt-2">
                <SummaryRow label="Estimated total"    value={formatCurrency(grandTotal)} bold />
              </div>
            </div>
          </div>
        </section>

        {/* ── Moving materials ─────────────────────────────────────────────── */}
        {showMaterials && (
          <section className="overflow-hidden rounded-lg bg-white shadow-sm">
            <button
              className="flex w-full items-center justify-between px-6 py-4 text-left"
              onClick={() => setMaterialsOpen(o => !o)}
            >
              <div>
                <h2 className="text-sm font-bold text-slate-900">Moving Materials</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {materialsSubtotal > 0
                    ? `${formatCurrency(materialsSubtotal)} in selected materials`
                    : 'Optional boxes, tape, and packing supplies'}
                </p>
              </div>
              {materialsOpen
                ? <ChevronUp size={18} className="text-slate-400" />
                : <ChevronDown size={18} className="text-slate-400" />}
            </button>
            {materialsOpen && (
              <div className="border-t border-slate-100 px-6 pb-5">
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
                  <div className="mt-4 flex justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold">
                    <span>Materials subtotal</span>
                    <span>{formatCurrency(materialsSubtotal)}</span>
                  </div>
                )}
                <p className="mt-3 text-[10px] text-slate-400">
                  Materials pricing does not include HST. Final invoice reflects confirmed quantities.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── Protection options ───────────────────────────────────────────── */}
        {showProtection && (
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={16} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">Protection Options</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Select the level of protection for your belongings.</p>
            <div className="space-y-3">
              {PROTECTION_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setProtection(opt.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-all ${
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
          </section>
        )}

        {/* ── Attachments ──────────────────────────────────────────────────── */}
        {cfg?.attachments && cfg.attachments.length > 0 && (
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Documents</h2>
            <div className="space-y-2">
              {cfg.attachments.map(a => (
                <a
                  key={a.id}
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Download size={14} className="text-slate-400 shrink-0" />
                  {a.name}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer notes ─────────────────────────────────────────────────── */}
        {cfg?.footer_notes && (
          <div className="rounded-lg bg-white px-6 py-5 shadow-sm text-sm text-slate-600">
            {renderRichNotes(cfg.footer_notes, mergeVars)}
          </div>
        )}

        {/* ── Disclaimer ───────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">
            Final total may vary based on actual time, services, inventory, and access conditions.
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Contact {companyName} if your inventory has changed significantly since this estimate was prepared.
          </p>
        </div>

      </div>

      {/* ── Sticky bottom CTA ────────────────────────────────────────────────── */}
      {!accepted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Estimated total</p>
              <p className="text-lg font-bold text-slate-950">{formatCurrency(grandTotal)}</p>
              <p className="text-xs text-slate-500">
                Deposit: <span className="font-semibold text-slate-800">{formatCurrency(deposit)}</span>
              </p>
            </div>
            <button
              onClick={() => setAcceptStep('confirm')}
              className="rounded px-6 py-3 bg-slate-950 text-white text-sm font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors"
            >
              Accept Estimate
            </button>
          </div>
        </div>
      )}

      {accepted && !paymentSucceeded && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-green-200 bg-green-50 px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0 text-green-600" />
            <p className="text-sm font-semibold text-green-800">Estimate accepted — your move date is secured.</p>
          </div>
        </div>
      )}

      {/* ── Accept modal ─────────────────────────────────────────────────────── */}
      {acceptStep !== 'idle' && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">

            {acceptStep === 'confirm' && (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="text-base font-bold text-slate-950">Accept Your Moving Estimate</h2>
                  <button onClick={closeModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
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
                      <span className="text-slate-500">Deposit</span>
                      <span className="font-bold text-kratos">{formatCurrency(deposit)}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    By accepting, you confirm that you have reviewed the estimate and understand the final total
                    may vary based on actual time, inventory, and access conditions.
                  </p>
                  {acceptError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {acceptError}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4">
                  <button
                    onClick={handleAccept}
                    disabled={acceptLoading}
                    className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
                  >
                    {acceptLoading && <Loader2 size={15} className="animate-spin" />}
                    Accept Estimate
                  </button>
                  <button onClick={closeModal} className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </>
            )}

            {acceptStep === 'deposit' && (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="text-base font-bold text-slate-950">Secure Your Move Date</h2>
                  <button onClick={closeModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 py-6 space-y-4 text-center">
                  <CheckCircle2 size={40} className="text-green-500 mx-auto" />
                  <div>
                    <p className="text-base font-bold text-slate-900">Estimate accepted!</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Pay your deposit of <strong>{formatCurrency(deposit)}</strong> to lock in your move date.
                    </p>
                  </div>
                  {checkoutError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-left">
                      {checkoutError}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4">
                  <button
                    onClick={handlePayDeposit}
                    disabled={checkoutLoading}
                    className="flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
                  >
                    {checkoutLoading && <Loader2 size={15} className="animate-spin" />}
                    Pay Deposit — {formatCurrency(deposit)}
                  </button>
                  {allowSkipDeposit && (
                    <button onClick={closeModal} className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50">
                      I&apos;ll pay later
                    </button>
                  )}
                  {!allowSkipDeposit && (
                    <p className="text-center text-xs text-slate-400">
                      A deposit is required to confirm your booking. Contact us at {companyPhone} if you have questions.
                    </p>
                  )}
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-500'}>{label}</span>
      <span className={bold ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}>{value}</span>
    </div>
  )
}

function InfoPanel({ title, lines }: { title: string; lines: string[] }) {
  const nonEmpty = lines.filter(Boolean)
  return (
    <div className="p-5">
      <p className="text-xs font-bold text-slate-800 mb-2">{title}</p>
      {nonEmpty.map((line, i) => (
        <p
          key={i}
          className={`leading-snug ${
            i === 0
              ? 'text-sm font-semibold text-slate-900'
              : 'text-xs text-slate-500 mt-0.5'
          }`}
        >
          {line}
        </p>
      ))}
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
