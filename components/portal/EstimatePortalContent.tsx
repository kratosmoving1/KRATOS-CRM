'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, Download,
  Home, Hourglass, Loader2, Minus, Phone, Plus, Shield,
  Tag, Truck, Users, Warehouse, X,
} from 'lucide-react'
import { MoveRoute } from './MoveRoute'
import { formatCurrency, formatCurrencyFull } from '@/lib/format'
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

export interface ContentBlock {
  id: string
  section_type: 'rich_text' | 'photo_gallery' | 'social_links' | 'company_logos'
  title: string | null
  body: string | null
  data: Record<string, unknown>
  position: number
  is_visible: boolean
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
  content_blocks?: ContentBlock[]
}

interface Props {
  data: PortalPageData
  token: string
  isPreview: boolean
  alreadySigned: boolean
  paymentSucceeded: boolean
  depositPaid?: boolean
  portalSettings: PortalSettings | null
  earnedPoints?: number
  totalPoints?: number
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
  const marked = text.replace(/\{\{\s*customer_name\s*\}\}/gi, '\x00CNAME\x00')
  const replaced = replaceMergeTags(marked, vars)
  const lines = replaced.split('\n')

  return lines.map((line, lineIdx) => {
    if (/^[-—–\s]{3,}$/.test(line.trim())) {
      return <div key={lineIdx} className="my-4 h-px bg-kratos opacity-50 w-16" />
    }
    if (line.trim() === '') {
      return <div key={lineIdx} className="h-3" />
    }

    const parts = line.split(/(\x00CNAME\x00|Accept Estimate)/g)

    // First line with the customer name gets larger treatment
    const isFirstLine = lineIdx === lines.findIndex(l => l.includes('\x00CNAME\x00') || (l.trim() && !/^[-—–\s]{3,}$/.test(l.trim())))
    const isNameLine = line.includes('\x00CNAME\x00')

    return (
      <p key={lineIdx} className={isNameLine && isFirstLine ? 'text-[17px] font-semibold leading-snug mb-1' : 'leading-relaxed text-slate-700'}>
        {parts.map((part, i) => {
          if (part === '\x00CNAME\x00') {
            return <strong key={i} className="font-bold text-kratos">{vars.customer_name || 'Customer'}</strong>
          }
          if (part === 'Accept Estimate') {
            return <span key={i} className="font-semibold text-kratos underline decoration-kratos/40 underline-offset-2">Accept Estimate</span>
          }
          return <span key={i}>{part}</span>
        })}
      </p>
    )
  })
}

// TODO: Replace with actual 30-day storage pricing from portal settings or opportunity config
const STORAGE_30_DAY_PRICE = 299.00

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

const KGC_COMPANIES = [
  { name: 'Moving',   logoUrl: '/logo.png', href: 'https://kratosgoc.com/moving' },
  { name: 'Cleaning', logoUrl: 'https://dyxopppyoqtwcorbdicf.supabase.co/storage/v1/object/public/logos/kratos-cleaning:logo-short.png', href: 'https://kratosgoc.com/cleaning' },
  { name: 'Painting', logoUrl: 'https://dyxopppyoqtwcorbdicf.supabase.co/storage/v1/object/public/logos/kratos-painting:logo-short.png', href: 'https://kratosgoc.com/painting' },
]

export default function EstimatePortalContent({
  data, token, isPreview, alreadySigned, paymentSucceeded, depositPaid, portalSettings,
  earnedPoints = 0, totalPoints = 0,
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

  // Hero right-side info lines — move facts now appear as chips in Estimate Breakdown
  const heroInfoLines = ['Non-Binding Estimate', 'Released Value Protection']

  // Materials + add-on state
  const [materialQty, setMaterialQty] = useState<Record<string, number>>({})
  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [storageAdded, setStorageAdded] = useState(false)
  const [protection, setProtection] = useState<ProtectionId>('basic')

  // Accept flow state
  const [accepted, setAccepted] = useState(alreadySigned || paymentSucceeded)
  const isDepositPaid = (depositPaid ?? false) || paymentSucceeded
  const [acceptStep, setAcceptStep] = useState<AcceptStep>('idle')
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const materialsSubtotal = useMemo(
    () => PORTAL_MATERIALS.reduce((sum, m) => sum + (materialQty[m.id] ?? 0) * m.unitPrice, 0),
    [materialQty],
  )
  const addonsSubtotal = materialsSubtotal + (storageAdded ? STORAGE_30_DAY_PRICE : 0)
  const grandTotal     = total + addonsSubtotal
  const grandHst       = hst + addonsSubtotal * 0.13
  const liveEarnedPoints = Math.floor((subtotal + addonsSubtotal) * 0.5)

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
      <div className="bg-[#0a0a0a] text-white pb-10">
        <div className="mx-auto max-w-5xl px-6 pt-10 sm:pt-14">
          <div className="flex items-start justify-between gap-8">

            {/* Left: logo + quote info */}
            <div className="flex-1 min-w-0">
              <Image
                src={cfg?.logo_url ?? '/logo.png'}
                alt={companyName}
                width={96}
                height={96}
                className="object-contain mb-4"
              />

              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-sm text-slate-400">
                  Estimate #{formatQuoteNumber(opp.opportunity_number)}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  accepted ? 'bg-green-700 text-green-100' : 'bg-amber-700/80 text-amber-100'
                }`}>
                  {accepted ? 'Booked' : 'Not Booked'}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1">
                Your Kratos move
                <span className="block text-kratos">is in motion.</span>
              </h1>

            </div>

            {/* Right: hourly rate + info lines */}
            {hourlyRate > 0 && (
              <div className="flex-shrink-0 text-right hidden sm:block">
                <p className="text-4xl font-semibold text-white leading-none mb-3">
                  {formatCurrencyFull(hourlyRate)}<span className="text-lg text-slate-400 font-normal">/hour</span>
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
              <p className="text-3xl font-semibold text-white">
                {formatCurrencyFull(hourlyRate)}<span className="text-lg text-slate-400 font-normal">/hour</span>
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

      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-5 pb-6 -mt-5 relative z-10">

        {/* ── Info panel ───────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl bg-white shadow-md">
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

        {/* ── Move route band ──────────────────────────────────────────────── */}
        <MoveRoute
          originAddress={opp.origin_address_line1}
          originCity={opp.origin_city}
          originProvince={opp.origin_province}
          destAddress={opp.dest_address_line1}
          destCity={opp.dest_city}
          destProvince={opp.dest_province}
        />

        {/* ── Header notes (rich rendered) ─────────────────────────────────── */}
        {cfg?.header_notes && (
          <div className="rounded-xl bg-white px-7 py-7 shadow-sm text-[15px] leading-relaxed text-slate-800">
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
          <h2 className="text-sm font-bold text-slate-900 mb-3">Estimate Breakdown</h2>

          {/* Fact chips — one authoritative source for all key job facts */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {opp.service_date && (
              <FactChip icon={<Calendar size={11} />} label={dateLabel(opp.service_date)} />
            )}
            <FactChip icon={<Clock size={11} />} label="Arrival: TBD" />
            {numCrew > 0 && (
              <FactChip icon={<Users size={11} />} label={`${numCrew} mover${numCrew !== 1 ? 's' : ''}`} />
            )}
            {numTrucks > 0 && (
              <FactChip icon={<Truck size={11} />} label={`${numTrucks} truck${numTrucks !== 1 ? 's' : ''}`} />
            )}
            {moveSize && <FactChip icon={<Home size={11} />} label={moveSize} />}
            {billableHours > 0 && (
              <FactChip icon={<Hourglass size={11} />} label={`${billableHours}h minimum`} />
            )}
            {hourlyRate > 0 && (
              <FactChip icon={<Tag size={11} />} label={`${formatCurrencyFull(hourlyRate)}/hr`} />
            )}
          </div>

          <div className="space-y-1.5 text-sm">
            {laborCharge && hourlyRate > 0 ? (
              <>
                {/* Package name + composition as the primary line item */}
                <div className="mb-1">
                  <SummaryRow
                    label={`${packageName} (${numTrucks} Truck${numTrucks !== 1 ? 's' : ''} & ${numCrew} Movers)`}
                    value={formatCurrencyFull(laborCharge.total)}
                    bold
                  />
                  {billableHours > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {billableHours}h @ {formatCurrencyFull(hourlyRate)}/hr
                      {travelHours > 0 && ` (incl. ${travelHours}h travel)`}
                    </p>
                  )}
                </div>
                {supplementaryCharges.length > 0 && <div className="border-t border-slate-100 my-2" />}
              </>
            ) : null}
            {supplementaryCharges.map((c, i) => (
              <div key={i}>
                <SummaryRow label={c.name} value={formatCurrencyFull(c.total)} />
                {c.discount_amount > 0 && (
                  <p className="text-xs text-green-700 ml-2 mt-0.5">Discount: − {formatCurrencyFull(c.discount_amount)}</p>
                )}
              </div>
            ))}
            <div className="border-t border-slate-100 mt-3 pt-3 space-y-1.5">
              <SummaryRow label="Subtotal"          value={formatCurrencyFull(subtotal)} />
              {discounts > 0 && <SummaryRow label="Discounts"       value={`− ${formatCurrencyFull(discounts)}`} />}
              {materialsSubtotal > 0 && <SummaryRow label="Moving materials" value={formatCurrencyFull(materialsSubtotal)} />}
              {storageAdded && <SummaryRow label="30 Days Storage" value={formatCurrencyFull(STORAGE_30_DAY_PRICE)} />}
              <SummaryRow label="HST (13%)"         value={formatCurrencyFull(grandHst)} />
              <div className="border-t border-slate-100 pt-2">
                <SummaryRow label="Estimated total" value={formatCurrencyFull(grandTotal)} bold />
              </div>
            </div>
          </div>
        </section>

        {/* ── Kratos package notes — right under estimate breakdown ─────── */}
        {cfg?.footer_notes && (
          <div className="rounded-lg bg-white px-6 py-5 shadow-sm text-sm text-slate-600">
            {renderRichNotes(cfg.footer_notes, mergeVars)}
          </div>
        )}

        {/* ── Add to your move ─────────────────────────────────────────────── */}
        {showMaterials && (
          <section className="overflow-hidden rounded-lg bg-white shadow-sm">

            {/* Section header */}
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Add to your move</h2>
              <p className="text-xs text-slate-500 mt-0.5">Optional services and supplies</p>
            </div>

            {/* Moving Materials sub-section */}
            <div className="border-b border-slate-100">
              <button
                className="flex w-full items-center justify-between px-6 py-3.5 text-left"
                onClick={() => setMaterialsOpen(o => !o)}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">Moving Materials</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {materialsSubtotal > 0
                      ? `${formatCurrencyFull(materialsSubtotal)} in selected materials`
                      : 'Boxes, tape, and packing supplies'}
                  </p>
                </div>
                {materialsOpen
                  ? <ChevronUp size={18} className="text-slate-400 shrink-0" />
                  : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
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
            </div>

            {/* 30 Days Storage add-on */}
            <div className="px-5 py-4">
              <button
                type="button"
                onClick={() => setStorageAdded(v => !v)}
                className={`w-full rounded-lg border p-4 text-left transition-all ${
                  storageAdded
                    ? 'border-kratos ring-1 ring-kratos bg-kratos/5'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 shrink-0">
                      <Warehouse size={18} className="text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">30 Days Storage</p>
                      <p className="text-xs text-slate-500 mt-0.5">Climate-controlled &amp; secure</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {storageAdded ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-kratos px-2.5 py-1 text-[11px] font-bold text-slate-950">
                        <CheckCircle2 size={11} /> Added
                      </span>
                    ) : (
                      <div>
                        <p className="text-sm font-bold text-slate-900">{formatCurrencyFull(STORAGE_30_DAY_PRICE)}</p>
                        <p className="text-[11px] font-semibold text-kratos">Add +</p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>

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

        {/* ── Content blocks ───────────────────────────────────────────────── */}
        {cfg?.content_blocks?.filter(b => b.is_visible).map(block => {
          if (block.section_type === 'rich_text')      return <RichTextBlock     key={block.id} block={block} />
          if (block.section_type === 'photo_gallery')  return <PhotoGalleryBlock key={block.id} block={block} />
          if (block.section_type === 'social_links')   return <SocialLinksBlock  key={block.id} block={block} />
          if (block.section_type === 'company_logos')  return <CompanyLogosBlock key={block.id} block={block} />
          return null
        })}

        {/* ── Kratos Points + Group ────────────────────────────────────────── */}
        <section className="rounded-2xl overflow-hidden shadow-xl" style={{ background: '#0a0a0a' }}>

          {/* Points hero */}
          <div className="relative px-7 pt-8 pb-7 overflow-hidden" style={{ borderBottom: '1px solid rgba(255,173,51,0.1)' }}>
            {/* ambient glow */}
            <div className="pointer-events-none absolute -top-10 -right-10 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,173,51,0.1) 0%, transparent 70%)' }} />

            <div className="flex items-center gap-2 mb-5">
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="#ffad33"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span className="text-[11px] font-black tracking-[0.22em] uppercase" style={{ color: '#ffad33' }}>Kratos Points</span>
            </div>

            <div className="flex items-end gap-4 mb-2">
              <span
                className="text-6xl font-black leading-none tabular-nums"
                style={{ color: '#ffad33', textShadow: '0 0 48px rgba(255,173,51,0.35)' }}
              >
                {liveEarnedPoints.toLocaleString()}
              </span>
              {totalPoints > 0 && (
                <span className="mb-1.5 text-base font-medium" style={{ color: '#475569' }}>
                  {totalPoints.toLocaleString()} total
                </span>
              )}
            </div>
            <p className="text-sm font-medium mb-3" style={{ color: '#94a3b8' }}>points earned from this estimate</p>
            <p className="text-xs" style={{ color: '#2d3748' }}>
              <em style={{ color: '#475569', fontStyle: 'italic' }}>Κράτος</em>
              {' '}— 0.5 pts per $1 subtotal · redeem at every Kratos Group company
            </p>
          </div>

          {/* Company cards */}
          <div className="px-7 pt-6 pb-7">
            <p className="text-[10px] font-black tracking-[0.2em] uppercase mb-5" style={{ color: '#2d3748' }}>Explore Kratos Group</p>
            <div className="grid grid-cols-3 gap-3">
              {KGC_COMPANIES.map(co => (
                <a
                  key={co.name}
                  href={co.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-2.5 rounded-xl px-2 py-4 transition-all duration-200 hover:scale-[1.03]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="flex items-center justify-center rounded-xl overflow-hidden"
                    style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,173,51,0.15)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={co.logoUrl}
                      alt={co.name}
                      style={{ width: 44, height: 44, objectFit: 'contain' }}
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-center leading-tight" style={{ color: '#64748b' }}>
                    {co.name}
                  </span>
                </a>
              ))}
            </div>
            <p className="text-[11px] mt-5 text-center" style={{ color: '#1e293b' }}>
              Redeem Kratos Points across every company in the Kratos Group.
            </p>
          </div>
        </section>

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

      {accepted && isDepositPaid && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-green-200 bg-green-50 px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0 text-green-600" />
            <p className="text-sm font-semibold text-green-800">Estimate accepted — your move date is secured.</p>
          </div>
        </div>
      )}

      {accepted && !isDepositPaid && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center">
                <span style={{ fontSize: 13, fontWeight: 'bold', color: '#fff' }}>!</span>
              </div>
              <p className="text-sm font-semibold text-amber-900">
                Estimate accepted — but your deposit hasn&apos;t been paid yet.
                <span className="hidden sm:inline text-amber-700 font-normal"> Pay now to fully secure your move date.</span>
              </p>
            </div>
            <button
              onClick={() => setAcceptStep('deposit')}
              className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
            >
              Pay Deposit — {formatCurrency(deposit)}
            </button>
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

function FactChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      <span className="text-kratos">{icon}</span>
      {label}
    </span>
  )
}

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
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      {nonEmpty.map((line, i) => (
        <p
          key={i}
          className={`leading-snug ${
            i === 0
              ? 'text-sm font-semibold text-slate-900'
              : 'text-xs text-slate-500 mt-1'
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

// ── Content block renderers ───────────────────────────────────────────────────

// Minimal inline markdown: **bold**, *italic*, and indented list items (i. ii. 1. 2.)
function renderBody(text: string): React.ReactNode {
  return text.split('\n').map((line, lineIdx) => {
    if (line.trim() === '') return <div key={lineIdx} className="h-2" />

    const isListItem = /^\s*(i{1,3}v?|vi{0,3}|ix|x|\d+)\.\s+/i.test(line.trim())
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    const rendered = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic">{part.slice(1, -1)}</em>
      }
      return <span key={i}>{part}</span>
    })

    return (
      <p key={lineIdx} className={`leading-relaxed ${isListItem ? 'ml-4 text-slate-700' : ''}`}>
        {rendered}
      </p>
    )
  })
}

function RichTextBlock({ block }: { block: ContentBlock }) {
  return (
    <section className="rounded-lg bg-white px-6 py-6 shadow-sm">
      {block.title && (
        <h2 className="text-base font-bold text-kratos mb-3">{block.title}</h2>
      )}
      {block.body && (
        <div className="text-sm text-slate-700 space-y-1">
          {renderBody(block.body)}
        </div>
      )}
    </section>
  )
}

function PhotoGalleryBlock({ block }: { block: ContentBlock }) {
  const images = (block.data.images ?? []) as Array<{ url: string; alt?: string }>
  if (!images.length) return null
  return (
    <section className="rounded-lg bg-white overflow-hidden shadow-sm">
      {block.title && (
        <div className="px-6 pt-5 pb-2">
          <h2 className="text-base font-bold text-kratos">{block.title}</h2>
        </div>
      )}
      <div className={`grid gap-2 p-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={img.url}
            alt={img.alt ?? ''}
            className="w-full rounded-md object-cover max-h-64"
          />
        ))}
      </div>
    </section>
  )
}

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
}

const SOCIAL_COLORS: Record<string, string> = {
  instagram: 'text-[#E1306C] hover:bg-[#E1306C]/10',
  facebook:  'text-[#1877F2] hover:bg-[#1877F2]/10',
  tiktok:    'text-[#010101] hover:bg-slate-100',
  youtube:   'text-[#FF0000] hover:bg-red-50',
  twitter:   'text-[#000000] hover:bg-slate-100',
}

function SocialLinksBlock({ block }: { block: ContentBlock }) {
  const links = (block.data.links ?? []) as Array<{ platform: string; url: string }>
  if (!links.length) return null
  return (
    <section className="rounded-lg bg-white px-6 py-6 shadow-sm text-center">
      {block.title && (
        <h2 className="text-base font-bold text-kratos mb-4">{block.title}</h2>
      )}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center w-14 h-14 rounded-full transition-colors ${SOCIAL_COLORS[link.platform] ?? 'text-slate-700 hover:bg-slate-100'}`}
          >
            {SOCIAL_ICONS[link.platform] ?? <span className="text-xs font-semibold uppercase">{link.platform.slice(0, 2)}</span>}
          </a>
        ))}
      </div>
    </section>
  )
}

function CompanyLogosBlock({ block }: { block: ContentBlock }) {
  const logos = (block.data.logos ?? []) as Array<{ url: string; name?: string }>
  return (
    <section className="rounded-lg bg-white px-6 py-6 shadow-sm text-center">
      {block.title && (
        <h2 className="text-base font-bold text-kratos mb-1">{block.title}</h2>
      )}
      {block.body && (
        <p className="text-sm text-slate-600 mb-4">{block.body}</p>
      )}
      {logos.length > 0 && (
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {logos.map((logo, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={logo.url}
              alt={logo.name ?? ''}
              className="h-16 w-auto object-contain"
              title={logo.name}
            />
          ))}
        </div>
      )}
    </section>
  )
}
