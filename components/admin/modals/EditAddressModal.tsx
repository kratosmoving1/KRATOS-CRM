'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ModalShell from '@/components/ui/ModalShell'
import { Input, Select, Textarea, Checkbox } from '@/components/ui/FormField'
import { AddressAutocomplete, type ParsedAddress } from '@/components/ui/AddressAutocomplete'
import { DWELLING_TYPES } from '@/lib/constants'

export interface EditAddressData {
  oppId: string
  prefix: 'origin' | 'dest'
  address_line1: string
  address_line2: string
  city: string
  province: string
  postal_code: string
  place_id: string
  dwelling_type: string
  floor: string
  has_elevator: boolean
  stairs_count: string
  long_carry: boolean
  parking_notes: string
}

interface Props {
  data: EditAddressData
  onClose: () => void
  onSaved: () => void
}

const SHOW_FLOOR_TYPES = new Set(['apartment', 'condo', 'office'])

export default function EditAddressModal({ data, onClose, onSaved }: Props) {
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    address_line1:  data.address_line1,
    address_line2:  data.address_line2,
    city:           data.city,
    province:       data.province,
    postal_code:    data.postal_code,
    place_id:       data.place_id,
    dwelling_type:  data.dwelling_type,
    floor:          data.floor,
    has_elevator:   data.has_elevator,
    stairs_count:   data.stairs_count,
    long_carry:     data.long_carry,
    parking_notes:  data.parking_notes,
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function handleSelect(parsed: ParsedAddress) {
    setForm(p => ({
      ...p,
      address_line1: parsed.addressLine1,
      city:          parsed.city,
      province:      parsed.province,
      postal_code:   parsed.postalCode,
      place_id:      parsed.placeId,
    }))
  }

  function handleAddressChange() {
    setForm(p => ({ ...p, city: '', province: '', postal_code: '', place_id: '' }))
  }

  const showFloor = SHOW_FLOOR_TYPES.has(form.dwelling_type)

  async function handleSave() {
    if (!form.address_line1.trim()) {
      toast.error('Address is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${data.oppId}/trip-info`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix:        data.prefix,
          address_line1: form.address_line1.trim(),
          address_line2: form.address_line2.trim() || null,
          city:          form.city || null,
          province:      form.province || null,
          postal_code:   form.postal_code || null,
          place_id:      form.place_id || null,
          dwelling_type: form.dwelling_type || null,
          floor:         form.floor !== '' ? Number(form.floor) : null,
          has_elevator:  form.has_elevator,
          stairs_count:  form.stairs_count !== '' ? Number(form.stairs_count) : null,
          long_carry:    form.long_carry,
          parking_notes: form.parking_notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to save address'); return }
      toast.success(`${data.prefix === 'origin' ? 'Origin' : 'Destination'} address updated.`)
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const label = data.prefix === 'origin' ? 'Origin Address' : 'Destination Address'

  return (
    <ModalShell
      title={`Edit ${label}`}
      subtitle={data.prefix === 'origin' ? 'ORIGIN' : 'DESTINATION'}
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Save Address
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Street Address <span className="text-red-500">*</span>
          </label>
          <AddressAutocomplete
            value={form.address_line1}
            onChange={handleAddressChange}
            onSelect={handleSelect}
            hasSelected={Boolean(form.city)}
            placeholder="Start typing an address…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
          />
          {form.city && (
            <p className="mt-1.5 text-xs text-slate-500">
              {[form.city, form.province, form.postal_code].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        <Input
          label="Apt / Unit / Suite"
          value={form.address_line2}
          onChange={e => set('address_line2', e.target.value)}
          placeholder="Unit 4B (optional)"
          autoComplete="off"
        />

        <Select
          label="Dwelling Type"
          placeholder="Select type…"
          value={form.dwelling_type}
          onChange={e => set('dwelling_type', e.target.value)}
          options={DWELLING_TYPES.map(d => ({ value: d.value, label: d.label }))}
        />

        {showFloor && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Floor #"
              type="number"
              min={0}
              value={form.floor}
              onChange={e => set('floor', e.target.value)}
              placeholder="2"
            />
            <div className="flex items-end pb-2">
              <Checkbox
                label="Has Elevator"
                checked={form.has_elevator}
                onChange={v => set('has_elevator', v)}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Number of Stairs"
            type="number"
            min={0}
            value={form.stairs_count}
            onChange={e => set('stairs_count', e.target.value)}
            placeholder="0"
          />
          <div className="flex items-end pb-2">
            <Checkbox
              label="Long Carry"
              checked={form.long_carry}
              onChange={v => set('long_carry', v)}
            />
          </div>
        </div>

        <Textarea
          label="Parking Notes"
          value={form.parking_notes}
          onChange={e => set('parking_notes', e.target.value)}
          placeholder="Street parking available on Oak Ave…"
        />
      </div>
    </ModalShell>
  )
}
