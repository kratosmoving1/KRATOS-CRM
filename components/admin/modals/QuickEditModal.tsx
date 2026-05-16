'use client'

import { useState, useEffect } from 'react'
import { Loader2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import ModalShell from '@/components/ui/ModalShell'
import { Input, Select, GroupedSelect } from '@/components/ui/FormField'
import { SERVICE_TYPES, MOVE_SIZE_GROUPS, PHONE_TYPES } from '@/lib/constants'

interface LeadSource { id: string; name: string }

interface QuickEditData {
  oppId: string
  customerId: string
  customerName: string
  customerPhone: string
  customerPhoneType: string
  customerEmail: string
  serviceDate: string | null
  serviceDateTbd: boolean
  serviceType: string
  moveSize: string
  leadSourceId: string
  leadSourceName: string | null
}

interface Props {
  data: QuickEditData
  onClose: () => void
  onSaved: () => void
  onOpenFullEdit: () => void
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function QuickEditModal({ data, onClose, onSaved, onOpenFullEdit }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    customerName:      data.customerName,
    customerPhone:     data.customerPhone,
    customerPhoneType: data.customerPhoneType || 'mobile',
    customerEmail:     data.customerEmail,
    serviceDate:       data.serviceDate ?? '',
    serviceDateTbd:    data.serviceDateTbd,
    serviceType:       data.serviceType,
    moveSize:          data.moveSize,
    leadSourceId:      data.leadSourceId,
  })

  useEffect(() => {
    fetch('/api/admin/lead-sources').then(r => r.json()).then(setLeadSources).catch(() => {})
  }, [])

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.customerName.trim()) errs.customerName = 'Required'
    if (!form.customerPhone.trim()) errs.customerPhone = 'Required'
    else if (form.customerPhone.replace(/\D/g, '').length !== 10) errs.customerPhone = 'Must be 10 digits'
    if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) errs.customerEmail = 'Invalid email'
    if (!form.serviceDateTbd && !form.serviceDate) errs.serviceDate = 'Set a date or check TBD'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${data.oppId}/quick-edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName:      form.customerName.trim(),
          customerPhone:     form.customerPhone.replace(/\D/g, ''),
          customerPhoneType: form.customerPhoneType,
          customerEmail:     form.customerEmail.trim() || null,
          serviceDate:       form.serviceDateTbd ? null : (form.serviceDate || null),
          serviceType:       form.serviceType,
          moveSize:          form.moveSize || null,
          leadSourceId:      form.leadSourceId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to save changes')
        return
      }
      toast.success('Customer details updated.')
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Quick Edit"
      subtitle="OPPORTUNITY"
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { onClose(); onOpenFullEdit() }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            <Settings size={14} />
            Edit Full Move Details
          </button>
          <div className="flex items-center gap-2">
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
              Save Changes
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="border-b border-slate-100 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Customer</p>
        </div>

        <Input
          label="Full Name"
          required
          value={form.customerName}
          onChange={e => update('customerName', e.target.value)}
          error={errors.customerName}
          placeholder="Jane Smith"
        />

        <div className="flex items-end gap-2">
          <Input
            label="Phone Number"
            required
            wrapClassName="flex-1"
            value={form.customerPhone}
            onChange={e => update('customerPhone', formatPhone(e.target.value))}
            error={errors.customerPhone}
            placeholder="(416) 555-0100"
          />
          <Select
            label="Type"
            wrapClassName="w-28"
            value={form.customerPhoneType}
            onChange={e => update('customerPhoneType', e.target.value)}
            options={PHONE_TYPES.map(p => ({ value: p.value, label: p.label }))}
          />
        </div>

        <Input
          label="Email"
          type="email"
          value={form.customerEmail}
          onChange={e => update('customerEmail', e.target.value)}
          error={errors.customerEmail}
          placeholder="jane@example.com"
        />

        <div className="border-b border-slate-100 pb-1 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Move Details</p>
        </div>

        <div>
          <Input
            label="Move Date"
            type="date"
            required={!form.serviceDateTbd}
            value={form.serviceDate}
            onChange={e => update('serviceDate', e.target.value)}
            disabled={form.serviceDateTbd}
            error={errors.serviceDate}
          />
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.serviceDateTbd}
              onChange={e => update('serviceDateTbd', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-kratos"
            />
            <span className="text-sm text-slate-600">TBD</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type of Service"
            value={form.serviceType}
            onChange={e => update('serviceType', e.target.value)}
            options={SERVICE_TYPES.map(s => ({ value: s.value, label: s.label }))}
          />
          <GroupedSelect
            label="Move Size"
            placeholder="Select…"
            value={form.moveSize}
            onChange={e => update('moveSize', e.target.value)}
            groups={MOVE_SIZE_GROUPS}
          />
        </div>

        <Select
          label="Referral Source"
          placeholder="Select source…"
          value={form.leadSourceId}
          onChange={e => update('leadSourceId', e.target.value)}
          options={leadSources.map(ls => ({ value: ls.id, label: ls.name }))}
        />
      </div>
    </ModalShell>
  )
}
