'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import ModalShell from '@/components/ui/ModalShell'
import { Input, Select, Textarea } from '@/components/ui/FormField'
import { PHONE_TYPES } from '@/lib/constants'

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

interface Props {
  onClose: () => void
}

export default function NewCustomerModal({ onClose }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSecondPhone, setShowSecondPhone] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    phone_type: 'mobile',
    secondary_phone: '',
    secondary_phone_type: 'mobile',
    email: '',
    notes: '',
  })

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.full_name.trim()) errs.full_name = 'Name is required'
    if (!form.phone.trim()) errs.phone = 'Phone is required'
    else if (form.phone.replace(/\D/g, '').length !== 10) errs.phone = 'Must be 10 digits'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Invalid email'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    setApiError(null)
    try {
      const payload: Record<string, string | null> = {
        full_name: form.full_name.trim(),
        phone: form.phone.replace(/\D/g, '') || null,
        phone_type: form.phone_type || null,
        secondary_phone: form.secondary_phone.replace(/\D/g, '') || null,
        secondary_phone_type: showSecondPhone ? (form.secondary_phone_type || null) : null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      }
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setApiError(json.error ?? 'Something went wrong'); return }
      toast.success('Customer created')
      onClose()
      router.push(`/admin/customers/${json.id}`)
    } catch {
      setApiError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Customer"
      subtitle="NEW"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create Customer
          </button>
        </div>
      }
    >
      {apiError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}

      <div className="space-y-5">
        <Input
          label="Full Name"
          required
          value={form.full_name}
          onChange={e => update('full_name', e.target.value)}
          error={errors.full_name}
          placeholder="e.g. Sarah Johnson"
          autoFocus
        />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Input
            label="Phone"
            required
            value={form.phone}
            onChange={e => update('phone', formatPhone(e.target.value))}
            error={errors.phone}
            placeholder="(416) 555-0100"
            inputMode="tel"
          />
          <div className="pt-6">
            <Select
              label=""
              value={form.phone_type}
              onChange={e => update('phone_type', e.target.value)}
              options={PHONE_TYPES.map(t => ({ value: t.value, label: t.label }))}
            />
          </div>
        </div>

        {showSecondPhone ? (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Input
              label="Secondary Phone"
              value={form.secondary_phone}
              onChange={e => update('secondary_phone', formatPhone(e.target.value))}
              placeholder="(416) 555-0101"
              inputMode="tel"
            />
            <div className="pt-6">
              <Select
                label=""
                value={form.secondary_phone_type}
                onChange={e => update('secondary_phone_type', e.target.value)}
                options={PHONE_TYPES.map(t => ({ value: t.value, label: t.label }))}
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSecondPhone(true)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-kratos"
          >
            <Plus size={14} />
            Add second phone
          </button>
        )}

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={e => update('email', e.target.value)}
          error={errors.email}
          placeholder="sarah@example.com"
        />

        <Textarea
          label="Internal Notes"
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="Any notes about this customer…"
          rows={3}
        />
      </div>
    </ModalShell>
  )
}
