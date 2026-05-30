'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, ChevronLeft, Loader2,
  Users, Truck, Package, Box, Plus,
  MapPin, Fuel, ShieldCheck, Move, Warehouse, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  calculateMovingLabor,
  calculateQuantityRate,
  calculateTripAndTravel,
  calculateFuelSurcharge,
  calculateValuation,
  calculateStorage,
  calculateStorageInTransit,
  applyDiscount,
} from '@/lib/charges/calculate'
import type { ChargeType } from '@/lib/charges/calculate'
import type { OpportunityCharge } from './types'
import { CHARGE_TYPE_LABELS } from './types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function numVal(v: string): number {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

// ─── Shared form field primitives ─────────────────────────────────────────────

function FLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold text-slate-500">{children}</label>
}

function FInput({
  label,
  prefix,
  suffix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; prefix?: string; suffix?: string }) {
  return (
    <div className="flex-1">
      {label && <FLabel>{label}</FLabel>}
      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 focus-within:border-kratos focus-within:bg-white focus-within:ring-2 focus-within:ring-kratos/20">
        {prefix && <span className="pl-3 text-sm text-slate-500">{prefix}</span>}
        <input
          {...props}
          className="w-full flex-1 rounded-lg bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none"
        />
        {suffix && <span className="pr-3 text-sm text-slate-500">{suffix}</span>}
      </div>
    </div>
  )
}

// ─── Discount section ─────────────────────────────────────────────────────────

interface DiscountSectionProps {
  subtotal: number
  discountType: 'percent' | 'amount' | null
  discountValue: string
  onTypeChange: (t: 'percent' | 'amount' | null) => void
  onValueChange: (v: string) => void
}

function DiscountSection({ subtotal, discountType, discountValue, onTypeChange, onValueChange }: DiscountSectionProps) {
  const dv = numVal(discountValue)
  const { discount_amount, total } = applyDiscount(subtotal, discountType, dv > 0 ? dv : null)

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Discount</span>
        <div className="flex rounded-lg border border-slate-200 bg-white text-xs overflow-hidden">
          <button
            type="button"
            onClick={() => onTypeChange(discountType === 'percent' ? null : 'percent')}
            className={`px-2.5 py-1.5 font-medium transition ${discountType === 'percent' ? 'bg-kratos text-slate-950' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => onTypeChange(discountType === 'amount' ? null : 'amount')}
            className={`px-2.5 py-1.5 font-medium transition ${discountType === 'amount' ? 'bg-kratos text-slate-950' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            $
          </button>
        </div>
      </div>

      {discountType && (
        <div className="flex gap-2">
          <FInput
            type="number"
            min={0}
            step={discountType === 'percent' ? '1' : '0.01'}
            placeholder={discountType === 'percent' ? '10' : '50.00'}
            suffix={discountType === 'percent' ? '%' : undefined}
            prefix={discountType === 'amount' ? '$' : undefined}
            value={discountValue}
            onChange={e => onValueChange(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="tabular-nums">{fmt(subtotal)}</span>
        </div>
        {discount_amount > 0 && (
          <div className="flex justify-between text-amber-600">
            <span>Discount</span>
            <span className="tabular-nums">−{fmt(discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">{fmt(total)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Individual charge forms ──────────────────────────────────────────────────

interface FormProps {
  initial?: Record<string, unknown>
  onResult: (payload: Partial<ChargeFormResult>) => void
}

export interface ChargeFormResult {
  name: string
  description: string | null
  config: Record<string, unknown>
  subtotal: number
  discount_type: 'percent' | 'amount' | null
  discount_value: number | null
  discount_amount: number
  total: number
  is_overridden: boolean
}

// Moving Labor form
function MovingLaborForm({ initial, onResult }: FormProps) {
  const cfg = (initial?.config as Record<string, unknown>) ?? {}
  const [trucks, setTrucks] = useState(String(cfg.num_trucks ?? 1))
  const [crew, setCrew] = useState(String(cfg.num_crew ?? 2))
  const [rate, setRate] = useState(String(cfg.hourly_rate ?? ''))
  const [laborH, setLaborH] = useState(String(cfg.labor_hours ?? ''))
  const [travelH, setTravelH] = useState(String(cfg.travel_hours ?? 0))
  const [hOrigin, setHOrigin] = useState(String(cfg.handicap_origin ?? 0))
  const [hStops, setHStops] = useState(String(cfg.handicap_stops ?? 0))
  const [hDest, setHDest] = useState(String(cfg.handicap_dest ?? 0))
  const [minH, setMinH] = useState(String(cfg.minimum_hours ?? 3))
  const [discountType, setDiscountType] = useState<'percent' | 'amount' | null>(
    (initial?.discount_type as 'percent' | 'amount' | null) ?? null
  )
  const [discountValue, setDiscountValue] = useState(String(initial?.discount_value ?? ''))

  const calcResult = useCallback(() => {
    const c = {
      num_trucks: numVal(trucks), num_crew: numVal(crew), hourly_rate: numVal(rate),
      labor_hours: numVal(laborH), travel_hours: numVal(travelH),
      handicap_origin: numVal(hOrigin), handicap_stops: numVal(hStops), handicap_dest: numVal(hDest),
      minimum_hours: numVal(minH),
    }
    const { total_hours, billable_hours, subtotal } = calculateMovingLabor(c)
    const dv = numVal(discountValue)
    const { discount_amount, total } = applyDiscount(subtotal, discountType, dv > 0 ? dv : null)
    const config: Record<string, unknown> = { ...c, total_hours, billable_hours }
    onResult({
      name: 'Moving Labor',
      description: `${billable_hours}h @ ${fmt(numVal(rate))}/hr · ${numVal(trucks)} truck, ${numVal(crew)} crew`,
      config,
      subtotal,
      discount_type: discountType,
      discount_value: dv > 0 ? dv : null,
      discount_amount,
      total,
      is_overridden: false,
    })
    return { total_hours, billable_hours, subtotal }
  }, [trucks, crew, rate, laborH, travelH, hOrigin, hStops, hDest, minH, discountType, discountValue, onResult])

  useEffect(() => { calcResult() }, [calcResult])

  const { total_hours, billable_hours, subtotal } = (() => {
    const c = {
      num_trucks: numVal(trucks), num_crew: numVal(crew), hourly_rate: numVal(rate),
      labor_hours: numVal(laborH), travel_hours: numVal(travelH),
      handicap_origin: numVal(hOrigin), handicap_stops: numVal(hStops), handicap_dest: numVal(hDest),
      minimum_hours: numVal(minH),
    }
    return calculateMovingLabor(c)
  })()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <FInput label="Trucks" type="number" min={1} value={trucks} onChange={e => setTrucks(e.target.value)} />
        <FInput label="Crew" type="number" min={1} value={crew} onChange={e => setCrew(e.target.value)} />
        <FInput label="Hourly Rate" type="number" min={0} step="0.01" prefix="$" value={rate} onChange={e => setRate(e.target.value)} />
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500">Labor Time</p>
        <div className="grid grid-cols-3 gap-3">
          <FInput label="Labor (h)" type="number" min={0} step="0.5" value={laborH} onChange={e => setLaborH(e.target.value)} />
          <FInput label="Travel (h)" type="number" min={0} step="0.5" value={travelH} onChange={e => setTravelH(e.target.value)} />
          <div className="flex-1">
            <FLabel>Total</FLabel>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-900">{total_hours}h</span>
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-500">Handicap Time</p>
        <div className="grid grid-cols-3 gap-3">
          <FInput label="Origin (h)" type="number" min={0} step="0.5" value={hOrigin} onChange={e => setHOrigin(e.target.value)} />
          <FInput label="Stops (h)" type="number" min={0} step="0.5" value={hStops} onChange={e => setHStops(e.target.value)} />
          <FInput label="Dest (h)" type="number" min={0} step="0.5" value={hDest} onChange={e => setHDest(e.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 pt-3 text-sm">
          <div>
            <FLabel>Total Time</FLabel>
            <p className="font-semibold text-slate-900">{total_hours}h</p>
          </div>
          <div>
            <FLabel>Minimum</FLabel>
            <FInput type="number" min={0} step="0.5" value={minH} onChange={e => setMinH(e.target.value)} />
          </div>
          <div>
            <FLabel>Billable</FLabel>
            <p className="font-semibold text-kratos">{billable_hours}h</p>
          </div>
        </div>
      </div>

      <DiscountSection
        subtotal={subtotal}
        discountType={discountType}
        discountValue={discountValue}
        onTypeChange={setDiscountType}
        onValueChange={setDiscountValue}
      />
    </div>
  )
}

// Simple Quantity × Rate form (Transportation, Packing, Additional Services, Materials, Bulky Item)
function SimpleQuantityForm({
  initial,
  onResult,
  defaultName,
  qtyLabel = 'Quantity',
  rateLabel = 'Unit Rate',
}: FormProps & { defaultName: string; qtyLabel?: string; rateLabel?: string }) {
  const cfg = (initial?.config as Record<string, unknown>) ?? {}
  const [name, setName] = useState(String(initial?.name ?? defaultName))
  const [description, setDescription] = useState(String(initial?.description ?? ''))
  const [qty, setQty] = useState(String(cfg.quantity ?? 1))
  const [unitRate, setUnitRate] = useState(String(cfg.unit_rate ?? ''))
  const [discountType, setDiscountType] = useState<'percent' | 'amount' | null>(
    (initial?.discount_type as 'percent' | 'amount' | null) ?? null
  )
  const [discountValue, setDiscountValue] = useState(String(initial?.discount_value ?? ''))

  const subtotal = calculateQuantityRate({ quantity: numVal(qty), unit_rate: numVal(unitRate) })
  const dv = numVal(discountValue)
  const { discount_amount, total } = applyDiscount(subtotal, discountType, dv > 0 ? dv : null)

  useEffect(() => {
    const config = { quantity: numVal(qty), unit_rate: numVal(unitRate) }
    onResult({
      name: name.trim() || defaultName,
      description: description.trim() || null,
      config,
      subtotal,
      discount_type: discountType,
      discount_value: dv > 0 ? dv : null,
      discount_amount,
      total,
      is_overridden: false,
    })
  }, [name, description, qty, unitRate, discountType, discountValue, subtotal, discount_amount, total, dv, defaultName, onResult])

  return (
    <div className="space-y-4">
      <FInput label="Name" value={name} onChange={e => setName(e.target.value)} placeholder={defaultName} />
      <div className="grid grid-cols-2 gap-3">
        <FInput label={qtyLabel} type="number" min={0} step="1" value={qty} onChange={e => setQty(e.target.value)} />
        <FInput label={rateLabel} type="number" min={0} step="0.01" prefix="$" value={unitRate} onChange={e => setUnitRate(e.target.value)} />
      </div>
      <FInput label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Details…" />
      <DiscountSection
        subtotal={subtotal}
        discountType={discountType}
        discountValue={discountValue}
        onTypeChange={setDiscountType}
        onValueChange={setDiscountValue}
      />
    </div>
  )
}

// Trip and Travel
function TripAndTravelForm({ initial, onResult }: FormProps) {
  const cfg = (initial?.config as Record<string, unknown>) ?? {}
  const [name, setName] = useState(String(initial?.name ?? 'Trip and Travel'))
  const [description, setDescription] = useState(String(initial?.description ?? ''))
  const [distKm, setDistKm] = useState(String(cfg.distance_km ?? ''))
  const [rateKm, setRateKm] = useState(String(cfg.rate_per_km ?? ''))
  const [discountType, setDiscountType] = useState<'percent' | 'amount' | null>(
    (initial?.discount_type as 'percent' | 'amount' | null) ?? null
  )
  const [discountValue, setDiscountValue] = useState(String(initial?.discount_value ?? ''))

  const subtotal = calculateTripAndTravel({ distance_km: numVal(distKm), rate_per_km: numVal(rateKm) })
  const dv = numVal(discountValue)
  const { discount_amount, total } = applyDiscount(subtotal, discountType, dv > 0 ? dv : null)

  useEffect(() => {
    onResult({
      name: name.trim() || 'Trip and Travel',
      description: description.trim() || null,
      config: { distance_km: numVal(distKm), rate_per_km: numVal(rateKm) },
      subtotal, discount_type: discountType,
      discount_value: dv > 0 ? dv : null, discount_amount, total, is_overridden: false,
    })
  }, [name, description, distKm, rateKm, discountType, discountValue, subtotal, discount_amount, total, dv, onResult])

  return (
    <div className="space-y-4">
      <FInput label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Trip and Travel" />
      <div className="grid grid-cols-2 gap-3">
        <FInput label="Distance (km)" type="number" min={0} step="1" value={distKm} onChange={e => setDistKm(e.target.value)} />
        <FInput label="Rate / km" type="number" min={0} step="0.01" prefix="$" value={rateKm} onChange={e => setRateKm(e.target.value)} />
      </div>
      <FInput label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Details…" />
      <DiscountSection
        subtotal={subtotal} discountType={discountType} discountValue={discountValue}
        onTypeChange={setDiscountType} onValueChange={setDiscountValue}
      />
    </div>
  )
}

// Fuel Surcharge
function FuelSurchargeForm({ initial, onResult, laborSubtotal }: FormProps & { laborSubtotal: number }) {
  const cfg = (initial?.config as Record<string, unknown>) ?? {}
  const [mode, setMode] = useState<'percent' | 'flat'>(cfg.percentage_of_labor != null ? 'percent' : 'flat')
  const [pct, setPct] = useState(String(cfg.percentage_of_labor ?? 10))
  const [flat, setFlat] = useState(String(cfg.flat_amount ?? ''))

  const subtotal = calculateFuelSurcharge({
    percentage_of_labor: mode === 'percent' ? numVal(pct) : undefined,
    flat_amount: mode === 'flat' ? numVal(flat) : undefined,
    labor_subtotal: laborSubtotal,
  })

  useEffect(() => {
    onResult({
      name: 'Fuel Surcharge',
      description: mode === 'percent' ? `${numVal(pct)}% of moving labor` : `Flat amount`,
      config: {
        percentage_of_labor: mode === 'percent' ? numVal(pct) : undefined,
        flat_amount: mode === 'flat' ? numVal(flat) : undefined,
        labor_subtotal: laborSubtotal,
      },
      subtotal, discount_type: null, discount_value: null, discount_amount: 0, total: subtotal, is_overridden: false,
    })
  }, [mode, pct, flat, laborSubtotal, subtotal, onResult])

  return (
    <div className="space-y-4">
      <div>
        <FLabel>Charge Mode</FLabel>
        <div className="flex gap-2">
          {(['percent', 'flat'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${mode === m ? 'border-kratos bg-kratos/10 text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {m === 'percent' ? '% of Moving Labor' : 'Flat Amount'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'percent' ? (
        <div>
          <FInput label="Percentage" type="number" min={0} step="0.5" suffix="%" value={pct} onChange={e => setPct(e.target.value)} />
          {laborSubtotal > 0 && (
            <p className="mt-1.5 text-xs text-slate-500">
              Applied to Moving Labor subtotal: {fmt(laborSubtotal)} → {fmt(subtotal)}
            </p>
          )}
          {laborSubtotal === 0 && (
            <p className="mt-1.5 text-xs text-amber-600">Add a Moving Labor charge first to use percentage mode.</p>
          )}
        </div>
      ) : (
        <FInput label="Flat Amount" type="number" min={0} step="0.01" prefix="$" value={flat} onChange={e => setFlat(e.target.value)} />
      )}

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex justify-between text-sm font-semibold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">{fmt(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">No discount applied to fuel surcharges.</p>
      </div>
    </div>
  )
}

// Valuation
function ValuationForm({ initial, onResult }: FormProps) {
  const cfg = (initial?.config as Record<string, unknown>) ?? {}
  const [coverage, setCoverage] = useState(String(cfg.coverage_amount ?? ''))
  const [rate, setPremRate] = useState(String(cfg.premium_rate ?? 0.6))
  const [description, setDescription] = useState(String(initial?.description ?? ''))

  const subtotal = calculateValuation({ coverage_amount: numVal(coverage), premium_rate: numVal(rate) })

  useEffect(() => {
    onResult({
      name: 'Valuation',
      description: description.trim() || null,
      config: { coverage_amount: numVal(coverage), premium_rate: numVal(rate) },
      subtotal, discount_type: null, discount_value: null, discount_amount: 0, total: subtotal, is_overridden: false,
    })
  }, [coverage, rate, description, subtotal, onResult])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FInput label="Coverage Amount" type="number" min={0} step="1000" prefix="$" value={coverage} onChange={e => setCoverage(e.target.value)} />
        <FInput label="Premium Rate (%)" type="number" min={0} step="0.1" suffix="%" value={rate} onChange={e => setPremRate(e.target.value)} />
      </div>
      <FInput label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Released value / declared value…" />
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex justify-between text-sm font-semibold text-slate-900">
          <span>Premium Total</span>
          <span className="tabular-nums">{fmt(subtotal)}</span>
        </div>
      </div>
    </div>
  )
}

// Storage
function StorageForm({ initial, onResult }: FormProps) {
  const cfg = (initial?.config as Record<string, unknown>) ?? {}
  const [monthlyRate, setMonthlyRate] = useState(String(cfg.monthly_rate ?? ''))
  const [months, setMonths] = useState(String(cfg.months ?? 1))
  const [discountType, setDiscountType] = useState<'percent' | 'amount' | null>(
    (initial?.discount_type as 'percent' | 'amount' | null) ?? null
  )
  const [discountValue, setDiscountValue] = useState(String(initial?.discount_value ?? ''))

  const subtotal = calculateStorage({ monthly_rate: numVal(monthlyRate), months: numVal(months) })
  const dv = numVal(discountValue)
  const { discount_amount, total } = applyDiscount(subtotal, discountType, dv > 0 ? dv : null)

  useEffect(() => {
    onResult({
      name: 'Storage',
      description: `${numVal(months)} month${numVal(months) !== 1 ? 's' : ''} @ ${fmt(numVal(monthlyRate))}/mo`,
      config: { monthly_rate: numVal(monthlyRate), months: numVal(months) },
      subtotal, discount_type: discountType,
      discount_value: dv > 0 ? dv : null, discount_amount, total, is_overridden: false,
    })
  }, [monthlyRate, months, discountType, discountValue, subtotal, discount_amount, total, dv, onResult])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FInput label="Monthly Rate" type="number" min={0} step="10" prefix="$" value={monthlyRate} onChange={e => setMonthlyRate(e.target.value)} />
        <FInput label="Months" type="number" min={1} step="1" value={months} onChange={e => setMonths(e.target.value)} />
      </div>
      <DiscountSection
        subtotal={subtotal} discountType={discountType} discountValue={discountValue}
        onTypeChange={setDiscountType} onValueChange={setDiscountValue}
      />
    </div>
  )
}

// Storage in Transit
function StorageInTransitForm({ initial, onResult }: FormProps) {
  const cfg = (initial?.config as Record<string, unknown>) ?? {}
  const [dailyRate, setDailyRate] = useState(String(cfg.daily_rate ?? ''))
  const [days, setDays] = useState(String(cfg.num_days ?? 1))
  const [discountType, setDiscountType] = useState<'percent' | 'amount' | null>(
    (initial?.discount_type as 'percent' | 'amount' | null) ?? null
  )
  const [discountValue, setDiscountValue] = useState(String(initial?.discount_value ?? ''))

  const subtotal = calculateStorageInTransit({ daily_rate: numVal(dailyRate), num_days: numVal(days) })
  const dv = numVal(discountValue)
  const { discount_amount, total } = applyDiscount(subtotal, discountType, dv > 0 ? dv : null)

  useEffect(() => {
    onResult({
      name: 'Storage in Transit',
      description: `${numVal(days)} day${numVal(days) !== 1 ? 's' : ''} @ ${fmt(numVal(dailyRate))}/day`,
      config: { daily_rate: numVal(dailyRate), num_days: numVal(days) },
      subtotal, discount_type: discountType,
      discount_value: dv > 0 ? dv : null, discount_amount, total, is_overridden: false,
    })
  }, [dailyRate, days, discountType, discountValue, subtotal, discount_amount, total, dv, onResult])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FInput label="Daily Rate" type="number" min={0} step="5" prefix="$" value={dailyRate} onChange={e => setDailyRate(e.target.value)} />
        <FInput label="Days" type="number" min={1} step="1" value={days} onChange={e => setDays(e.target.value)} />
      </div>
      <DiscountSection
        subtotal={subtotal} discountType={discountType} discountValue={discountValue}
        onTypeChange={setDiscountType} onValueChange={setDiscountValue}
      />
    </div>
  )
}

// ─── Category Selector ────────────────────────────────────────────────────────

const CHARGE_CATEGORIES: {
  type: ChargeType
  label: string
  icon: React.ElementType
  description: string
}[] = [
  { type: 'moving_labor',        label: 'Moving Labor',         icon: Users,       description: 'Hourly crew labor' },
  { type: 'transportation',      label: 'Transportation',        icon: Truck,       description: 'Trucking / vehicle charges' },
  { type: 'packing',             label: 'Packing',               icon: Package,     description: 'Packing labor and service' },
  { type: 'materials',           label: 'Materials',             icon: Box,         description: 'Boxes, tape, wrap, supplies' },
  { type: 'additional_services', label: 'Additional Services',   icon: Plus,        description: 'Hoisting, disassembly, etc.' },
  { type: 'trip_and_travel',     label: 'Trip and Travel',       icon: MapPin,      description: 'Distance-based charges' },
  { type: 'fuel_surcharge',      label: 'Fuel Surcharge',        icon: Fuel,        description: 'Fuel adjustment' },
  { type: 'valuation',           label: 'Valuation',             icon: ShieldCheck, description: 'Coverage / insurance' },
  { type: 'bulky_item',          label: 'Bulky Item',            icon: Move,        description: 'Piano, safe, hot tub, etc.' },
  { type: 'storage',             label: 'Storage',               icon: Warehouse,   description: 'Monthly storage fee' },
  { type: 'storage_in_transit',  label: 'Storage in Transit',    icon: Clock,       description: 'Daily SIT fee' },
]

// ─── Main ChargeSidePanel ─────────────────────────────────────────────────────

interface ChargeSidePanelProps {
  open: boolean
  oppId: string
  editingCharge: OpportunityCharge | null
  charges: OpportunityCharge[]
  onClose: () => void
  onSaved: () => void
  /** Pre-filled config for Moving Labor when opened from the tariff recommendation panel */
  defaultLaborConfig?: Record<string, unknown> | null
}

export default function ChargeSidePanel({ open, oppId, editingCharge, charges, onClose, onSaved, defaultLaborConfig }: ChargeSidePanelProps) {
  const [screen, setScreen] = useState<'categories' | 'form'>('categories')
  const [selectedType, setSelectedType] = useState<ChargeType | null>(null)
  const [formResult, setFormResult] = useState<Partial<ChargeFormResult> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Current moving labor subtotal (for fuel surcharge % mode)
  const laborSubtotal = charges
    .filter(c => c.charge_type === 'moving_labor')
    .reduce((s, c) => s + c.subtotal, 0)

  // Pre-select type when editing or when tariff pre-fill is provided
  useEffect(() => {
    if (editingCharge) {
      setSelectedType(editingCharge.charge_type)
      setScreen('form')
    } else if (defaultLaborConfig) {
      setSelectedType('moving_labor')
      setScreen('form')
    } else {
      setScreen('categories')
      setSelectedType(null)
    }
    setFormResult(null)
  }, [editingCharge, open, defaultLaborConfig])

  function handleCategorySelect(type: ChargeType) {
    setSelectedType(type)
    setScreen('form')
    setFormResult(null)
  }

  const handleFormResult = useCallback((result: Partial<ChargeFormResult>) => {
    setFormResult(result)
  }, [])

  async function handleSave() {
    if (!formResult || !selectedType) return
    setSubmitting(true)
    try {
      const url = editingCharge
        ? `/api/admin/opportunities/${oppId}/charges/${editingCharge.id}`
        : `/api/admin/opportunities/${oppId}/charges`
      const method = editingCharge ? 'PATCH' : 'POST'
      const body = { ...formResult, charge_type: selectedType }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to save charge'); return }
      toast.success(editingCharge ? 'Charge updated.' : 'Charge added.')
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const editInitial = editingCharge
    ? {
        name: editingCharge.name,
        description: editingCharge.description,
        config: editingCharge.config,
        discount_type: editingCharge.discount_type,
        discount_value: editingCharge.discount_value,
        subtotal: editingCharge.subtotal,
        is_overridden: editingCharge.is_overridden,
      }
    : defaultLaborConfig && selectedType === 'moving_labor'
    ? { config: defaultLaborConfig }
    : undefined

  function renderForm() {
    if (!selectedType) return null
    switch (selectedType) {
      case 'moving_labor':
        return <MovingLaborForm initial={editInitial} onResult={handleFormResult} />
      case 'transportation':
        return <SimpleQuantityForm defaultName="Transportation" qtyLabel="Trips" rateLabel="Rate / Trip" initial={editInitial} onResult={handleFormResult} />
      case 'packing':
        return <SimpleQuantityForm defaultName="Packing" qtyLabel="Hours" rateLabel="Hourly Rate" initial={editInitial} onResult={handleFormResult} />
      case 'materials':
        return <SimpleQuantityForm defaultName="Packing Materials" qtyLabel="Items" rateLabel="Unit Price" initial={editInitial} onResult={handleFormResult} />
      case 'additional_services':
        return <SimpleQuantityForm defaultName="Additional Services" initial={editInitial} onResult={handleFormResult} />
      case 'trip_and_travel':
        return <TripAndTravelForm initial={editInitial} onResult={handleFormResult} />
      case 'fuel_surcharge':
        return <FuelSurchargeForm initial={editInitial} onResult={handleFormResult} laborSubtotal={laborSubtotal} />
      case 'valuation':
        return <ValuationForm initial={editInitial} onResult={handleFormResult} />
      case 'bulky_item':
        return <SimpleQuantityForm defaultName="Bulky Item" qtyLabel="Items" rateLabel="Rate / Item" initial={editInitial} onResult={handleFormResult} />
      case 'storage':
        return <StorageForm initial={editInitial} onResult={handleFormResult} />
      case 'storage_in_transit':
        return <StorageInTransitForm initial={editInitial} onResult={handleFormResult} />
    }
  }

  const isFormReady = formResult != null && (formResult.total ?? 0) >= 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            {screen === 'form' && !editingCharge && (
              <button
                type="button"
                onClick={() => setScreen('categories')}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {screen === 'categories' ? 'Add Charge' : editingCharge ? 'Edit Charge' : 'Add Charge'}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                {screen === 'categories'
                  ? 'Select Type'
                  : selectedType ? CHARGE_TYPE_LABELS[selectedType] : ''}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {screen === 'categories' ? (
            <div className="space-y-2">
              {CHARGE_CATEGORIES.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleCategorySelect(type)}
                  className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left transition hover:border-kratos/40 hover:bg-kratos/5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <p className="font-semibold text-slate-900">{label}</p>
                    <p className="text-sm text-slate-500">{description}</p>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            renderForm()
          )}
        </div>

        {/* Footer (only in form screen) */}
        {screen === 'form' && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || !isFormReady}
              className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {editingCharge ? 'Save Changes' : '+ Add Charge'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
