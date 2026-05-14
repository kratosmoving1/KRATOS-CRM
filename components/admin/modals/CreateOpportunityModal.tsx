'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import ModalShell from '@/components/ui/ModalShell'
import { Input, Select, Textarea, Checkbox, GroupedSelect } from '@/components/ui/FormField'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'
import type { ParsedAddress } from '@/components/ui/AddressAutocomplete'
import {
  SERVICE_TYPES, MOVE_SIZE_GROUPS, PHONE_TYPES, DWELLING_TYPES,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

const STEPS = [
  { label: 'Personal Info' },
  { label: 'Origin' },
  { label: 'Destination' },
]

type AddressForm = {
  address_1: string; address_2: string; city: string; province: string
  postal_code: string; place_id: string; dwelling_type: string; floor: string
  has_elevator: boolean; stairs: string; long_carry: boolean; parking_notes: string
}

const emptyAddress = (): AddressForm => ({
  address_1: '', address_2: '', city: '', province: '', postal_code: '', place_id: '',
  dwelling_type: '', floor: '', has_elevator: false, stairs: '', long_carry: false, parking_notes: '',
})

type Step1Form = {
  customer_name: string; customer_phone: string; customer_phone_type: string
  customer_secondary_phone: string; customer_secondary_phone_type: string
  customer_email: string; service_date: string; service_date_tbd: boolean
  service_type: string; move_size: string; lead_source_id: string
}

type Errors = Record<string, string>

interface LeadSource { id: string; name: string }

interface Props {
  onClose: () => void
  initialData?: Record<string, unknown>
  editId?: string
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

export default function CreateOpportunityModal({ onClose, initialData, editId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [showSecondPhone, setShowSecondPhone] = useState(false)

  const [s1, setS1] = useState<Step1Form>({
    customer_name: '', customer_phone: '', customer_phone_type: 'mobile',
    customer_secondary_phone: '', customer_secondary_phone_type: 'mobile',
    customer_email: '', service_date: '', service_date_tbd: false,
    service_type: 'local', move_size: '', lead_source_id: '',
    ...((initialData ?? {}) as Partial<Step1Form>),
  })
  const [origin, setOrigin] = useState<AddressForm>(emptyAddress())
  const [dest, setDest] = useState<AddressForm>(emptyAddress())

  useEffect(() => {
    fetch('/api/admin/lead-sources')
      .then(r => r.json())
      .then(setLeadSources)
      .catch(() => {})
  }, [])

  function updateS1<K extends keyof Step1Form>(k: K, v: Step1Form[K]) {
    setS1(p => ({ ...p, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  function updateAddr(
    side: 'origin' | 'dest',
    setter: typeof setOrigin,
    k: keyof AddressForm,
    v: string | boolean,
  ) {
    setter(p => ({ ...p, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[`${side}_${k}`]; return n })
  }

  function validateStep1(): boolean {
    const errs: Errors = {}
    if (!s1.customer_name.trim()) errs.customer_name = 'Name is required'
    if (!s1.customer_phone.trim()) errs.customer_phone = 'Phone is required'
    else if (s1.customer_phone.replace(/\D/g,'').length !== 10) errs.customer_phone = 'Must be 10 digits'
    if (s1.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s1.customer_email)) {
      errs.customer_email = 'Invalid email'
    }
    if (!s1.service_date_tbd && !s1.service_date) errs.service_date = 'Set a date or check TBD'
    if (!s1.service_type) errs.service_type = 'Required'
    if (!s1.move_size)    errs.move_size    = 'Required'
    // lead_source_id is optional
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2(): boolean { return true }
  function validateStep3(): boolean { return true }

  const buildPayload = useCallback(() => ({
    customer_name:               s1.customer_name,
    customer_phone:              s1.customer_phone.replace(/\D/g,''),
    customer_phone_type:         s1.customer_phone_type,
    customer_secondary_phone:    s1.customer_secondary_phone.replace(/\D/g,'') || null,
    customer_secondary_phone_type: s1.customer_secondary_phone_type || null,
    customer_email:              s1.customer_email || null,
    service_date:                s1.service_date_tbd ? null : (s1.service_date || null),
    service_type:                s1.service_type,
    move_size:                   s1.move_size || null,
    lead_source_id:              s1.lead_source_id || null,
    origin_address_line1:  origin.address_1    || null,
    origin_address_line2:  origin.address_2    || null,
    origin_city:           origin.city         || null,
    origin_province:       origin.province     || null,
    origin_postal_code:    origin.postal_code  || null,
    origin_place_id:       origin.place_id     || null,
    origin_dwelling_type:  origin.dwelling_type || null,
    origin_floor:          origin.floor ? parseInt(origin.floor) : null,
    origin_has_elevator:   origin.has_elevator || null,
    origin_stairs:         origin.stairs ? parseInt(origin.stairs) : null,
    origin_long_carry:     origin.long_carry   || null,
    origin_parking_notes:  origin.parking_notes || null,
    dest_address_line1:    dest.address_1      || null,
    dest_address_line2:    dest.address_2      || null,
    dest_city:             dest.city           || null,
    dest_province:         dest.province       || null,
    dest_postal_code:      dest.postal_code    || null,
    dest_place_id:         dest.place_id       || null,
    dest_dwelling_type:    dest.dwelling_type  || null,
    dest_floor:            dest.floor ? parseInt(dest.floor) : null,
    dest_has_elevator:     dest.has_elevator   || null,
    dest_stairs:           dest.stairs ? parseInt(dest.stairs) : null,
    dest_long_carry:       dest.long_carry     || null,
    dest_parking_notes:    dest.parking_notes  || null,
  }), [s1, origin, dest])

  async function submit(saveAndClose = false) {
    setSubmitting(true)
    setApiError(null)
    try {
      const payload = buildPayload()
      const method = editId ? 'PATCH' : 'POST'
      const url = editId
        ? `/api/admin/opportunities/${editId}`
        : '/api/admin/opportunities'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setApiError(json.error ?? 'Something went wrong'); return }
      toast.success(editId ? 'Opportunity updated' : 'Opportunity created')
      onClose()
      router.push(`/admin/opportunities/${json.id}`)
    } catch {
      setApiError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function handleNext() {
    const validators = [validateStep1, validateStep2, validateStep3]
    if (!validators[step]()) return
    if (step < 2) setStep(s => s + 1)
    else submit()
  }

  const showFloor = (d: AddressForm) =>
    ['apartment', 'condo', 'office'].includes(d.dwelling_type)

  return (
    <ModalShell
      title={editId ? 'Opportunity' : 'Opportunity'}
      subtitle={editId ? 'EDIT' : 'CREATE'}
      steps={STEPS}
      currentStep={step}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => { if (validateStep1()) submit(true) }}
              disabled={submitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save & Close
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {step < 2 ? 'Next' : editId ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      }
    >
      {apiError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4">
          <Input
            label="Full Name"
            required
            value={s1.customer_name}
            onChange={e => updateS1('customer_name', e.target.value)}
            error={errors.customer_name}
            placeholder="Jane Smith"
          />

          <div className="flex items-end gap-2">
            <Input
              label="Phone Number"
              required
              wrapClassName="flex-1"
              value={s1.customer_phone}
              onChange={e => updateS1('customer_phone', formatPhone(e.target.value))}
              error={errors.customer_phone}
              placeholder="(416) 555-0100"
            />
            <Select
              label="Type"
              wrapClassName="w-28"
              value={s1.customer_phone_type}
              onChange={e => updateS1('customer_phone_type', e.target.value)}
              options={PHONE_TYPES.map(p => ({ value: p.value, label: p.label }))}
            />
            <button
              type="button"
              onClick={() => setShowSecondPhone(v => !v)}
              className="mb-0.5 flex h-[42px] w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
              title={showSecondPhone ? 'Remove second phone' : 'Add second phone'}
            >
              {showSecondPhone ? <Minus size={16} /> : <Plus size={16} />}
            </button>
          </div>

          {showSecondPhone && (
            <div className="flex items-end gap-2">
              <Input
                label="Second Phone"
                wrapClassName="flex-1"
                value={s1.customer_secondary_phone}
                onChange={e => updateS1('customer_secondary_phone', formatPhone(e.target.value))}
                placeholder="(416) 555-0101"
              />
              <Select
                label="Type"
                wrapClassName="w-28"
                value={s1.customer_secondary_phone_type}
                onChange={e => updateS1('customer_secondary_phone_type', e.target.value)}
                options={PHONE_TYPES.map(p => ({ value: p.value, label: p.label }))}
              />
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={s1.customer_email}
            onChange={e => updateS1('customer_email', e.target.value)}
            error={errors.customer_email}
            placeholder="jane@example.com"
          />

          <div>
            <Input
              label="Move Date"
              type="date"
              required={!s1.service_date_tbd}
              value={s1.service_date}
              onChange={e => updateS1('service_date', e.target.value)}
              error={errors.service_date}
              disabled={s1.service_date_tbd}
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={s1.service_date_tbd}
                onChange={e => updateS1('service_date_tbd', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-kratos"
              />
              <span className="text-sm text-slate-600">Set Move Date to TBD</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type of Service"
              required
              value={s1.service_type}
              onChange={e => updateS1('service_type', e.target.value)}
              error={errors.service_type}
              options={SERVICE_TYPES.map(s => ({ value: s.value, label: s.label }))}
            />
            <GroupedSelect
              label="Move Size"
              required
              placeholder="Select size…"
              value={s1.move_size}
              onChange={e => updateS1('move_size', e.target.value)}
              error={errors.move_size}
              groups={MOVE_SIZE_GROUPS}
            />
          </div>

          <Select
            label="Referral Source"
            placeholder="Select source…"
            value={s1.lead_source_id}
            onChange={e => updateS1('lead_source_id', e.target.value)}
            options={leadSources.map(ls => ({ value: ls.id, label: ls.name }))}
          />
        </div>
      )}

      {(step === 1 || step === 2) && (() => {
        const isOrigin = step === 1
        const addr     = isOrigin ? origin : dest
        const setAddr  = isOrigin ? setOrigin : setDest
        const side     = isOrigin ? 'origin' : 'dest'
        const prefix   = isOrigin ? 'Origin / Pickup' : 'Destination / Dropoff'

        function applyParsed(parsed: ParsedAddress) {
          setAddr(prev => ({
            ...prev,
            address_1:   parsed.addressLine1 || prev.address_1,
            city:        parsed.city         || prev.city,
            province:    parsed.province     || prev.province,
            postal_code: parsed.postalCode   || prev.postal_code,
            place_id:    parsed.placeId      || prev.place_id,
          }))
        }

        return (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{prefix}</p>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Address
              </label>
              <AddressAutocomplete
                value={addr.address_1}
                onChange={v => {
                  setAddr(prev => ({ ...prev, address_1: v, city: '', province: '', postal_code: '', place_id: '' }))
                  setErrors(e => { const n = { ...e }; delete n[`${side}_address_1`]; return n })
                }}
                onSelect={applyParsed}
                hasSelected={Boolean(addr.city)}
                placeholder="Start typing an address…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
              />
              {addr.city && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {[addr.city, addr.province, addr.postal_code].filter(Boolean).join(', ')}
                </p>
              )}
            </div>

            <Input
              label="Apt / Unit / Suite"
              value={addr.address_2}
              onChange={e => updateAddr(side, setAddr, 'address_2', e.target.value)}
              placeholder="Unit 4B (optional)"
              autoComplete="off"
            />

            <Select
              label="Dwelling Type"
              placeholder="Select type…"
              value={addr.dwelling_type}
              onChange={e => updateAddr(side, setAddr, 'dwelling_type', e.target.value)}
              options={DWELLING_TYPES.map(d => ({ value: d.value, label: d.label }))}
            />

            {showFloor(addr) && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Floor #"
                  type="number"
                  min={0}
                  value={addr.floor}
                  onChange={e => updateAddr(side, setAddr, 'floor', e.target.value)}
                  placeholder="2"
                />
                <div className="flex items-end pb-2">
                  <Checkbox
                    label="Has Elevator"
                    checked={addr.has_elevator}
                    onChange={v => updateAddr(side, setAddr, 'has_elevator', v)}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Number of Stairs"
                type="number"
                min={0}
                value={addr.stairs}
                onChange={e => updateAddr(side, setAddr, 'stairs', e.target.value)}
                placeholder="0"
              />
              <div className="flex items-end pb-2">
                <Checkbox
                  label="Long Carry"
                  checked={addr.long_carry}
                  onChange={v => updateAddr(side, setAddr, 'long_carry', v)}
                />
              </div>
            </div>

            <Textarea
              label="Parking Notes"
              value={addr.parking_notes}
              onChange={e => updateAddr(side, setAddr, 'parking_notes', e.target.value)}
              placeholder="Street parking available on Oak Ave…"
            />
          </div>
        )
      })()}
    </ModalShell>
  )
}
