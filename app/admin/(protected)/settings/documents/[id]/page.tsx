'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import DocumentTemplateForm, { type DocumentTemplateData } from '@/components/admin/documents/DocumentTemplateForm'

export default function EditDocumentTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DocumentTemplateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/document-templates/${id}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setError(j.error ?? 'Failed to load template')
          return
        }
        const t = await res.json()
        setData({
          id: t.id,
          name: t.name,
          category: t.category,
          description: t.description ?? '',
          content_html: t.content_html ?? '',
          content_json: t.content_json ?? null,
          status: t.status,
        })
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-red-600">{error ?? 'Template not found'}</p>
      </div>
    )
  }

  return <DocumentTemplateForm mode="edit" initialData={data} />
}
