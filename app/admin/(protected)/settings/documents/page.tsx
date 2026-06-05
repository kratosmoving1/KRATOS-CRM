'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, MoreHorizontal, Pencil, Copy, Trash2, FileText, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CATEGORY_LABELS } from '@/lib/documents/merge-fields'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile { full_name: string }

interface DocumentTemplate {
  id: string
  name: string
  category: string
  description: string | null
  status: 'draft' | 'published'
  updated_at: string
  published_at: string | null
  updater: Profile | null
  publisher: Profile | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Card menu ─────────────────────────────────────────────────────────────────

function CardMenu({
  templateId,
  onDuplicate,
  onDeleteRequest,
}: {
  templateId: string
  onDuplicate: () => void
  onDeleteRequest: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={e => { e.preventDefault(); setOpen(v => !v) }}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <Link
              href={`/admin/settings/documents/${templateId}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={13} /> Edit
            </Link>
            <button
              type="button"
              onClick={() => { setOpen(false); onDuplicate() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onDeleteRequest() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DocumentTemplate | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/document-templates')
      if (res.ok) setTemplates(await res.json())
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/admin/document-templates/${id}/duplicate`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Duplicate failed')
        return
      }
      toast.success('Template duplicated.')
      load()
    } catch {
      toast.error('Network error')
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletingId(confirmDelete.id)
    try {
      const res = await fetch(`/api/admin/document-templates/${confirmDelete.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Delete failed')
        return
      }
      toast.success('Template deleted.')
      setConfirmDelete(null)
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Documents</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading ? '...' : `${templates.length} TOTAL`}
          </p>
        </div>
        <Link
          href="/admin/settings/documents/new"
          className="flex items-center gap-1.5 rounded-lg bg-kratos px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> New Document
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <FileText size={28} className="text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-700">No document templates yet</h3>
          <p className="mt-1 text-sm text-slate-400">Create your first template to get started.</p>
          <Link
            href="/admin/settings/documents/new"
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-kratos px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90"
          >
            <Plus size={14} /> Create your first template
          </Link>
        </div>
      )}

      {/* Grid */}
      {!loading && templates.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map(t => (
            <div
              key={t.id}
              className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all flex flex-col"
            >
              {/* Draft indicator */}
              {t.status === 'draft' && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" title="Draft" />
                </div>
              )}

              {/* Icon + name */}
              <div className="flex items-start gap-3 mb-3 pr-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <FileText size={16} className="text-slate-500" />
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/admin/settings/documents/${t.id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-kratos line-clamp-2"
                  >
                    {t.name}
                  </Link>
                  <span className={cn(
                    'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    'bg-slate-100 text-slate-600',
                  )}>
                    {CATEGORY_LABELS[t.category] ?? t.category}
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="mt-auto space-y-0.5 text-xs text-slate-400">
                <p>
                  <span className="font-medium text-slate-500">Modified:</span>{' '}
                  {formatDate(t.updated_at)}
                  {t.updater?.full_name ? ` — ${t.updater.full_name}` : ''}
                </p>
                {t.published_at && (
                  <p>
                    <span className="font-medium text-slate-500">Published:</span>{' '}
                    {formatDate(t.published_at)}
                    {t.publisher?.full_name ? ` — ${t.publisher.full_name}` : ''}
                  </p>
                )}
              </div>

              {/* Three-dot menu */}
              <div className="absolute bottom-3 right-3">
                <CardMenu
                  templateId={t.id}
                  onDuplicate={() => handleDuplicate(t.id)}
                  onDeleteRequest={() => setConfirmDelete(t)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">Delete this template?</p>
                <p className="mt-1 text-sm text-slate-600">
                  <strong>{confirmDelete.name}</strong> will be permanently removed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={15} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!!deletingId}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
