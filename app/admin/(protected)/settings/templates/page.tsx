'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Template = {
  id: string
  name: string
  channel: 'sms' | 'email' | 'call'
  trigger: string
  subject: string | null
  body: string
  is_active: boolean
}

const VARIABLES = [
  '{{customer_first_name}}',
  '{{customer_full_name}}',
  '{{agent_first_name}}',
  '{{agent_full_name}}',
  '{{company_phone}}',
  '{{move_date}}',
  '{{origin_city}}',
  '{{destination_city}}',
  '{{estimate_link}}',
  '{{booking_link}}',
]

const SAMPLE_VARS: Record<string, string> = {
  customer_first_name: 'Sarah',
  customer_full_name: 'Sarah Johnson',
  agent_first_name: 'Alex',
  agent_full_name: 'Alex Smith',
  company_phone: '(800) 321-3222',
  move_date: 'June 12, 2026',
  origin_city: 'Toronto',
  destination_city: 'Ottawa',
  estimate_link: 'https://kratosmoving.ca/estimate/example',
  booking_link: 'https://kratosmoving.ca/book/example',
}

function renderTemplate(value: string) {
  return value.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key: string) => SAMPLE_VARS[key] ?? '')
}

export default function TemplatesSettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<'all' | 'sms' | 'email'>('all')
  const [triggerFilter, setTriggerFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/communication-templates')
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? 'Unable to load templates')
          return
        }
        setTemplates(data.templates ?? [])
        setCanEdit(Boolean(data.canEdit))
        setSelectedId(data.templates?.[0]?.id ?? null)
      } catch {
        toast.error('Unable to load templates')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const triggers = useMemo(() => {
    return Array.from(new Set(templates.map(template => template.trigger))).sort()
  }, [templates])

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const channelMatches = channelFilter === 'all' || template.channel === channelFilter
      const triggerMatches = triggerFilter === 'all' || template.trigger === triggerFilter
      return channelMatches && triggerMatches
    })
  }, [templates, channelFilter, triggerFilter])

  const selectedTemplate = templates.find(template => template.id === selectedId) ?? filteredTemplates[0] ?? null

  useEffect(() => {
    if (filteredTemplates.length > 0 && !filteredTemplates.some(template => template.id === selectedId)) {
      setSelectedId(filteredTemplates[0].id)
    }
  }, [filteredTemplates, selectedId])

  function updateSelected(patch: Partial<Template>) {
    if (!selectedTemplate) return
    setTemplates(current => current.map(template => (
      template.id === selectedTemplate.id ? { ...template, ...patch } : template
    )))
  }

  async function saveTemplate() {
    if (!selectedTemplate || !canEdit) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/communication-templates/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedTemplate.name,
          subject: selectedTemplate.subject,
          body: selectedTemplate.body,
          is_active: selectedTemplate.is_active,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Unable to save template')
        return
      }

      setTemplates(current => current.map(template => template.id === data.id ? data : template))
      toast.success('Template saved')
    } catch {
      toast.error('Unable to save template')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-kratos" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Communication Templates</h1>
          <p className="mt-1 text-sm text-slate-500">Default SMS and email follow-ups used by the sales workflow.</p>
        </div>
        <button
          onClick={saveTemplate}
          disabled={!canEdit || !selectedTemplate || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-kratos px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'sms', 'email'] as const).map(channel => (
          <button
            key={channel}
            onClick={() => setChannelFilter(channel)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium capitalize',
              channelFilter === channel ? 'border-kratos bg-kratos/10 text-slate-950' : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            {channel === 'sms' ? 'SMS' : channel}
          </button>
        ))}
        <select
          value={triggerFilter}
          onChange={event => setTriggerFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="all">All triggers</option>
          {triggers.map(trigger => (
            <option key={trigger} value={trigger}>{trigger.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filteredTemplates.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No templates match the current filters.</p>
          ) : filteredTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => setSelectedId(template.id)}
              className={cn(
                'block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50',
                selectedTemplate?.id === template.id && 'bg-kratos/10',
              )}
            >
              <span className="block text-sm font-semibold text-slate-900">{template.name}</span>
              <span className="mt-1 block text-xs uppercase tracking-widest text-slate-400">
                {template.channel} / {template.trigger.replace(/_/g, ' ')}
              </span>
            </button>
          ))}
        </div>

        {selectedTemplate && (
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Name
                  <input
                    value={selectedTemplate.name}
                    onChange={event => updateSelected({ name: event.target.value })}
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kratos disabled:bg-slate-50"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Trigger
                  <input
                    value={selectedTemplate.trigger.replace(/_/g, ' ')}
                    disabled
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm capitalize text-slate-500"
                  />
                </label>
              </div>

              {selectedTemplate.channel === 'email' && (
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Subject
                  <input
                    value={selectedTemplate.subject ?? ''}
                    onChange={event => updateSelected({ subject: event.target.value })}
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kratos disabled:bg-slate-50"
                  />
                </label>
              )}

              <label className="mt-4 block text-sm font-medium text-slate-700">
                Body
                <textarea
                  value={selectedTemplate.body}
                  onChange={event => updateSelected({ body: event.target.value })}
                  disabled={!canEdit}
                  rows={12}
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-kratos disabled:bg-slate-50"
                />
              </label>

              <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedTemplate.is_active}
                  onChange={event => updateSelected({ is_active: event.target.checked })}
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border-slate-300 text-kratos"
                />
                Active
              </label>
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Variables</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VARIABLES.map(variable => (
                    <code key={variable} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {variable}
                    </code>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Preview</h2>
                {selectedTemplate.subject && (
                  <p className="mt-3 text-sm font-semibold text-slate-900">{renderTemplate(selectedTemplate.subject)}</p>
                )}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {renderTemplate(selectedTemplate.body)}
                </p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
