'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Minus } from 'lucide-react'
import { toast } from 'sonner'
import ModalShell from '@/components/ui/ModalShell'
import { Input, Select } from '@/components/ui/FormField'
import { SERVICE_TYPES, MOVE_SIZES, PHONE_TYPES } from '@/lib/constants'

interface LeadSource { id: string; name: string }

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

export default function CreateLeadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [leadSources, setLeadSources] = useState<LeadSource[]>([])
  const [showSecondPhone, setShowSecondPhone] = useState(false)

  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_phone_type: 'mobile',
    customer_secondary_phone: '', customer_secondary_phone_type: 'mobile',
    customer_email: '', service_date: '', service_date_tbd: false,
    service_type: 'local', move_size: '', lead_source_id: '',
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
    if (!form.customer_name.trim()) errs.customer_name = 'Required'
    if (!form.customer_phone.trim()) errs.customer_phone = 'Required'
    else if (form.customer_phone.replace(/\D/g,'').length !== 10) errs.customer_phone = 'Must be 10 digits'
    if (form.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email)) errs.customer_email = 'Invalid email'
    if (!form.service_date_tbd && !form.service_date) errs.service_date = 'Set a date or check TBD'
    if (!form.move_size) errs.move_size = 'Required'
    // lead_source_id is optional
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    setApiError(null)
    try {
      const res = await fetch('/api/admin/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          customer_phone: form.customer_phone.replace(/\D/g,''),
          status: 'opportunity',
        }),
      })
      const json = await res.json()
      if (!res.ok) { setApiError(json.error ?? 'Something went wrong'); return }
      toast.success('Lead created')
      onClose()
      router.push(`/admin/opportunities/${json.id}`)
    } catch {
      setApiError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Lead"
      subtitle="NEW"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-between">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create Lead
          </button>
        </div>
      }
    >
      {apiError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}
      <div className="space-y-4">
        <Input label="Full Name" required value={form.customer_name}
          onChange={e => update('customer_name', e.target.value)} error={errors.customer_name} placeholder="Jane Smith" />
        <div className="flex items-end gap-2">
          <Input label="Phone Number" required wrapClassName="flex-1"
            value={form.customer_phone} onChange={e => update('customer_phone', formatPhone(e.target.value))}
            error={errors.customer_phone} placeholder="(416) 555-0100" />
          <Select label="Type" wrapClassName="w-28" value={form.customer_phone_type}
            onChange={e => update('customer_phone_type', e.target.value)}
            options={PHONE_TYPES.map(p => ({ value: p.value, label: p.label }))} />
          <button type="button" onClick={() => setShowSecondPhone(v => !v)}
            className="mb-0.5 flex h-[42px] w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100">
            {showSecondPhone ? <Minus size={16} /> : <Plus size={16} />}
          </button>
        </div>
        {showSecondPhone && (
          <div className="flex items-end gap-2">
            <Input label="Second Phone" wrapClassName="flex-1" value={form.customer_secondary_phone}
              onChange={e => update('customer_secondary_phone', formatPhone(e.target.value))} placeholder="(416) 555-0101" />
            <Select label="Type" wrapClassName="w-28" value={form.customer_secondary_phone_type}
              onChange={e => update('customer_secondary_phone_type', e.target.value)}
              options={PHONE_TYPES.map(p => ({ value: p.value, label: p.label }))} />
          </div>
        )}
        <Input label="Email" type="email" value={form.customer_email}
          onChange={e => update('customer_email', e.target.value)} error={errors.customer_email} placeholder="jane@example.com" />
        <div>
          <Input label="Move Date" type="date" required={!form.service_date_tbd}
            value={form.service_date} onChange={e => update('service_date', e.target.value)}
            disabled={form.service_date_tbd} error={errors.service_date} />
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={form.service_date_tbd}
              onChange={e => update('service_date_tbd', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-kratos" />
            <span className="text-sm text-slate-600">TBD</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Type of Service" value={form.service_type} onChange={e => update('service_type', e.target.value)}
            options={SERVICE_TYPES.map(s => ({ value: s.value, label: s.label }))} />
          <Select label="Move Size" required placeholder="Select…" value={form.move_size}
            onChange={e => update('move_size', e.target.value)} error={errors.move_size}
            options={MOVE_SIZES.map(s => ({ value: s.value, label: s.label }))} />
        </div>
        <Select label="Referral Source" placeholder="Select source…" value={form.lead_source_id}
          onChange={e => update('lead_source_id', e.target.value)}
          options={leadSources.map(ls => ({ value: ls.id, label: ls.name }))} />
      </div>
    </ModalShell>
  )
}
