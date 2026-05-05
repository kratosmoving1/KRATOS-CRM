'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ModalShell from '@/components/ui/ModalShell'
import { Input, Select, Textarea } from '@/components/ui/FormField'
import { FOLLOW_UP_TYPES } from '@/lib/constants'

interface Profile { id: string; full_name: string }

export default function CreateFollowUpModal({ onClose }: { onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [profiles, setProfiles] = useState<Profile[]>([])

  const [form, setForm] = useState({
    follow_up_date: '', follow_up_time: '', type: 'call',
    notes: '', assigned_to_id: '', opportunity_id: '',
  })

  useEffect(() => {
    fetch('/api/admin/profiles').then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  async function handleSubmit() {
    const errs: Record<string, string> = {}
    if (!form.follow_up_date) errs.follow_up_date = 'Date is required'
    if (!form.type) errs.type = 'Type is required'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    setApiError(null)
    try {
      const res = await fetch('/api/admin/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setApiError(json.error ?? 'Something went wrong'); return }
      toast.success('Follow-up created')
      onClose()
    } catch {
      setApiError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Follow-up"
      subtitle="NEW"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-between">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create Follow-up
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
        <div className="grid grid-cols-2 gap-4">
          <Input label="Follow-up Date" type="date" required value={form.follow_up_date}
            onChange={e => update('follow_up_date', e.target.value)} error={errors.follow_up_date} />
          <Input label="Time (optional)" type="time" value={form.follow_up_time}
            onChange={e => update('follow_up_time', e.target.value)} />
        </div>
        <Select label="Type" required placeholder="Select type…" value={form.type}
          onChange={e => update('type', e.target.value)} error={errors.type}
          options={FOLLOW_UP_TYPES.map(t => ({ value: t.value, label: t.label }))} />
        <Textarea label="Notes" value={form.notes}
          onChange={e => update('notes', e.target.value)} placeholder="Details about this follow-up…" />
        <Select label="Assigned To" placeholder="Select agent…" value={form.assigned_to_id}
          onChange={e => update('assigned_to_id', e.target.value)}
          options={profiles.map(p => ({ value: p.id, label: p.full_name }))} />
      </div>
    </ModalShell>
  )
}
