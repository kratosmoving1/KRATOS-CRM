'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Trash2, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/documents/merge-fields'
import type { DocumentEditorHandle } from './DocumentEditor'
import MergeFieldPicker from './MergeFieldPicker'

// Dynamic import to avoid SSR issues with TipTap
const DocumentEditor = dynamic(() => import('./DocumentEditor'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-[600px] rounded-xl border border-slate-200 bg-slate-50">
    <Loader2 className="animate-spin text-slate-400" size={24} />
  </div>
) })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentTemplateData {
  id?: string
  name: string
  category: string
  description: string
  content_html: string
  content_json: object | null
  status: 'draft' | 'published'
}

interface Props {
  initialData?: DocumentTemplateData
  mode: 'new' | 'edit'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentTemplateForm({ initialData, mode }: Props) {
  const router = useRouter()
  const editorRef = useRef<DocumentEditorHandle>(null)

  const [name, setName] = useState(initialData?.name ?? '')
  const [category, setCategory] = useState(initialData?.category ?? CATEGORIES[0])
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [status, setStatus] = useState<'draft' | 'published'>(initialData?.status ?? 'draft')
  const [contentHtml, setContentHtml] = useState(initialData?.content_html ?? '')
  const [contentJson, setContentJson] = useState<object | null>(initialData?.content_json ?? null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Track dirty state
  useEffect(() => {
    if (initialData) setIsDirty(false)
  }, [initialData])

  const markDirty = useCallback(() => setIsDirty(true), [])

  // Warn on unload if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleEditorUpdate = useCallback((html: string, json: object) => {
    setContentHtml(html)
    setContentJson(json)
    markDirty()
  }, [markDirty])

  const handleInsertMergeField = useCallback((token: string) => {
    editorRef.current?.insertMergeField(token)
  }, [])

  async function handleSave() {
    if (!name.trim()) { toast.error('Template name is required'); return }
    if (!category) { toast.error('Category is required'); return }

    setSaving(true)
    try {
      const body = { name: name.trim(), category, description: description.trim() || null, content_html: contentHtml, content_json: contentJson, status }

      const isEdit = mode === 'edit' && initialData?.id
      const res = await fetch(
        isEdit
          ? `/api/admin/document-templates/${initialData!.id}`
          : '/api/admin/document-templates',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )

      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Save failed'); return }

      setIsDirty(false)
      toast.success(mode === 'new' ? 'Template created.' : 'Template saved.')
      router.push('/admin/settings/documents')
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialData?.id) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/document-templates/${initialData.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error ?? 'Delete failed')
        return
      }
      setIsDirty(false)
      toast.success('Template deleted.')
      router.push('/admin/settings/documents')
    } catch {
      toast.error('Network error')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/admin/settings/documents')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={15} /> Back to Documents
        </button>
        <h1 className="text-lg font-semibold text-slate-900">
          {mode === 'new' ? 'New Document Template' : 'Edit Template'}
        </h1>
        <div className="w-32" />
      </div>

      {/* 3-column layout */}
      <div className="flex gap-4 items-start">
        {/* ── Left column: details ── */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Template Details</h2>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); markDirty() }}
                placeholder="e.g. Estimate for Moving Services"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={e => { setCategory(e.target.value); markDirty() }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => { setDescription(e.target.value); markDirty() }}
                placeholder="Optional notes about this template..."
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20 resize-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Status</label>
              <div className="flex gap-4">
                {(['draft', 'published'] as const).map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={status === s}
                      onChange={() => { setStatus(s); markDirty() }}
                      className="accent-kratos"
                    />
                    <span className="text-sm text-slate-700 capitalize">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-kratos py-2 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>

          {/* Delete button — edit only */}
          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} /> Delete Template
            </button>
          )}
        </div>

        {/* ── Center column: editor ── */}
        <div className="flex-1 min-w-0">
          <DocumentEditor
            ref={editorRef}
            initialContent={initialData?.content_html ?? ''}
            onUpdate={handleEditorUpdate}
            placeholder="Start writing your document. Use the merge fields panel on the right to insert dynamic data."
          />
        </div>

        {/* ── Right column: merge field picker ── */}
        <div className="w-64 shrink-0 sticky top-6" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <MergeFieldPicker onInsert={handleInsertMergeField} />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-semibold text-slate-900">Delete this template?</h3>
            <p className="mt-2 text-sm text-slate-500">
              <strong>{name}</strong> will be permanently removed. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
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
