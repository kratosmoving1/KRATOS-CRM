'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Channel = 'email' | 'sms'

type Template = {
  id: string
  name: string
  channel: Channel | 'call'
  trigger: string
  subject: string | null
  body: string
  is_active: boolean
  created_at: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA', { month: 'numeric', day: 'numeric', year: 'numeric' })
}

function preview(body: string, max = 80) {
  const flat = body.replace(/\n+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max) + '...' : flat
}

// ── Row menu ──────────────────────────────────────────────────────────────────

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <button type="button" onClick={() => { setOpen(false); onEdit() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Pencil size={13} /> Edit
            </button>
            <button type="button" onClick={() => { setOpen(false); onDelete() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

interface ModalProps {
  initial: Partial<Template> & { channel: Channel }
  onSave: (t: Partial<Template>) => Promise<void>
  onClose: () => void
}

function TemplateModal({ initial, onSave, onClose }: ModalProps) {
  const [name, setName] = useState(initial.name ?? '')
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [body, setBody] = useState(initial.body ?? '')
  const [isActive, setIsActive] = useState(initial.is_active ?? true)
  const [saving, setSaving] = useState(false)

  const isEmail = initial.channel === 'email'

  async function submit() {
    if (!name.trim() || !body.trim()) { toast.error('Name and body are required'); return }
    if (isEmail && !subject.trim()) { toast.error('Subject is required for email templates'); return }
    setSaving(true)
    await onSave({ name: name.trim(), subject: isEmail ? subject.trim() : null, body: body.trim(), is_active: isActive })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            {initial.id ? 'Edit Template' : `New ${isEmail ? 'Email' : 'SMS'} Template`}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Template Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Follow-Up 1"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20" />
          </div>
          {isEmail && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20" />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-500">Body</label>
              <span className="text-[10px] text-slate-400">Use: @FirstName @MoveDate @OriginCity @EstimateLink</span>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={7}
              placeholder="Hi @FirstName, ..."
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-kratos" />
            Active (visible in template pickers)
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial.id ? 'Save Changes' : 'Add Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Template table for one channel ───────────────────────────────────────────

function TemplateTable({
  channel,
  templates,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  channel: Channel
  templates: Template[]
  canEdit: boolean
  onAdd: () => void
  onEdit: (t: Template) => void
  onDelete: (t: Template) => void
}) {
  const label = channel === 'email' ? 'Email' : 'SMS'
  const list = templates.filter(t => t.channel === channel)

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
        {canEdit && (
          <button type="button" onClick={onAdd}
            className="flex items-center gap-1.5 rounded-lg bg-kratos px-3 py-1.5 text-xs font-semibold text-slate-950 hover:opacity-90">
            <Plus size={12} /> Add {label} Template
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          No {label.toLowerCase()} templates yet.{' '}
          {canEdit && (
            <button type="button" onClick={onAdd} className="font-medium text-kratos hover:underline">
              Add one.
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 text-left w-48">Name</th>
                <th className="px-4 py-3 text-left">Preview</th>
                <th className="px-4 py-3 text-left w-28">Created On</th>
                <th className="w-10 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map(t => (
                <tr key={t.id} className="group hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => canEdit && onEdit(t)}
                      className={cn('text-left font-medium text-slate-900', canEdit && 'hover:text-kratos cursor-pointer')}>
                      {t.name}
                    </button>
                    {!t.is_active && (
                      <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">
                    {t.channel === 'email' && t.subject && (
                      <p className="font-medium text-slate-700 truncate mb-0.5">{t.subject}</p>
                    )}
                    <p className="truncate">{preview(t.body)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(t.created_at)}</td>
                  <td className="py-3 pr-3">
                    {canEdit && <RowMenu onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TemplatesSettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)

  // Modal state
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; channel: Channel; template?: Template } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/communication-templates')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load templates'); return }
      setTemplates(data.templates ?? [])
      setCanEdit(Boolean(data.canEdit))
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(patch: Partial<Template>) {
    if (modal?.mode === 'edit' && modal.template) {
      const res = await fetch(`/api/admin/communication-templates/${modal.template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to save'); return }
      setTemplates(prev => prev.map(t => t.id === json.id ? json : t))
      toast.success('Template updated.')
    } else if (modal?.mode === 'add') {
      const res = await fetch('/api/admin/communication-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, channel: modal.channel }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to create'); return }
      setTemplates(prev => [...prev, json])
      toast.success('Template added.')
    }
    setModal(null)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/communication-templates/${confirmDelete.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) { toast.error('Failed to delete'); return }
      setTemplates(prev => prev.filter(t => t.id !== confirmDelete.id))
      toast.success('Template deleted.')
      setConfirmDelete(null)
    } catch { toast.error('Network error') }
    finally { setDeleting(false) }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-kratos" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Settings / Templates</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Sales Templates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the default templates that agents can use for emails and SMS messages.
        </p>
      </div>

      <TemplateTable
        channel="email"
        templates={templates}
        canEdit={canEdit}
        onAdd={() => setModal({ mode: 'add', channel: 'email' })}
        onEdit={t => setModal({ mode: 'edit', channel: 'email', template: t })}
        onDelete={t => setConfirmDelete(t)}
      />

      <TemplateTable
        channel="sms"
        templates={templates}
        canEdit={canEdit}
        onAdd={() => setModal({ mode: 'add', channel: 'sms' })}
        onEdit={t => setModal({ mode: 'edit', channel: 'sms', template: t })}
        onDelete={t => setConfirmDelete(t)}
      />

      {/* Add / Edit modal */}
      {modal && (
        <TemplateModal
          initial={modal.template ? { ...modal.template, channel: modal.channel } : { channel: modal.channel }}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-semibold text-slate-900">Delete template?</h3>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium">{confirmDelete.name}</span> will be permanently deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {deleting && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
