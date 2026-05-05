'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ModalShell from '@/components/ui/ModalShell'
import { Input, Select, Textarea } from '@/components/ui/FormField'
import { TASK_PRIORITIES } from '@/lib/constants'

interface Profile { id: string; full_name: string }

export default function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')

  const [form, setForm] = useState({
    title: '', description: '', due_date: '', due_time: '',
    priority: 'normal', assigned_to_id: '', opportunity_id: '',
  })

  useEffect(() => {
    fetch('/api/admin/profiles').then(r => r.json()).then((data: Profile[]) => {
      setProfiles(data)
    }).catch(() => {})
  }, [])

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  async function handleSubmit() {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    setApiError(null)
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setApiError(json.error ?? 'Something went wrong'); return }
      toast.success('Task created')
      onClose()
    } catch {
      setApiError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      title="Task"
      subtitle="NEW"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-between">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create Task
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
        <Input label="Title" required value={form.title}
          onChange={e => update('title', e.target.value)} error={errors.title} placeholder="Follow up with client" />
        <Textarea label="Description" value={form.description}
          onChange={e => update('description', e.target.value)} placeholder="Additional details…" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Due Date" type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} />
          <Input label="Due Time" type="time" value={form.due_time} onChange={e => update('due_time', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Priority" value={form.priority} onChange={e => update('priority', e.target.value)}
            options={TASK_PRIORITIES.map(p => ({ value: p.value, label: p.label }))} />
          <Select label="Assigned To" placeholder="Select agent…" value={form.assigned_to_id}
            onChange={e => update('assigned_to_id', e.target.value)}
            options={profiles.map(p => ({ value: p.id, label: p.full_name }))} />
        </div>
      </div>
    </ModalShell>
  )
}
