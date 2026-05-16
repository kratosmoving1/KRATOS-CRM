'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ModalShell from '@/components/ui/ModalShell'
import { Input, Select } from '@/components/ui/FormField'
import { PHONE_TYPES } from '@/lib/constants'

export interface QuickEditData {
  oppId: string
  customerId: string
  customerName: string
  customerPhone: string
  customerPhoneType: string
  customerEmail: string
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
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    customerName:      data.customerName,
    customerPhone:     data.customerPhone,
    customerPhoneType: data.customerPhoneType || 'mobile',
    customerEmail:     data.customerEmail,
  })

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
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to save changes'); return }
      toast.success('Contact details updated.')
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
      title="Edit Customer Contact"
      subtitle="QUICK EDIT"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => { onClose(); onOpenFullEdit() }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 sm:w-auto"
          >
            Edit Full Move Details
          </button>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex min-w-32 items-center justify-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Full Name"
          required
          value={form.customerName}
          onChange={e => update('customerName', e.target.value)}
          error={errors.customerName}
          placeholder="Jane Smith"
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_140px] sm:items-end">
          <Input
            label="Phone Number"
            required
            value={form.customerPhone}
            onChange={e => update('customerPhone', formatPhone(e.target.value))}
            error={errors.customerPhone}
            placeholder="(416) 555-0100"
          />
          <Select
            label="Type"
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
      </div>
    </ModalShell>
  )
}
