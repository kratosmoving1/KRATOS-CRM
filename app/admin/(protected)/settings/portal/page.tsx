'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Plus, Trash2, Save } from 'lucide-react'

interface PortalAttachment {
  id: string
  name: string
  file_url: string
  position: number
}

interface PortalBadge {
  id: string
  name: string
  image_url: string | null
  position: number
}

interface PortalSettings {
  id: string
  company_name: string
  company_phone: string
  logo_url: string | null
  header_notes: string | null
  footer_notes: string | null
  show_inventory_button: boolean
  show_download_button: boolean
  show_materials_section: boolean
  show_protection_section: boolean
  require_deposit: boolean
  allow_accept_without_deposit: boolean
  attachments: PortalAttachment[]
  badges: PortalBadge[]
}

const MERGE_TAG_HELP = '{{customer_name}}  {{quote_number}}  {{move_date}}  {{company_phone}}  {{origin_city}}  {{destination_city}}'

export default function PortalSettingsPage() {
  const [settings, setSettings] = useState<PortalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add badge/attachment form state
  const [newBadgeName, setNewBadgeName] = useState('')
  const [newBadgeUrl, setNewBadgeUrl] = useState('')
  const [newAttachName, setNewAttachName] = useState('')
  const [newAttachUrl, setNewAttachUrl] = useState('')
  const [addingBadge, setAddingBadge] = useState(false)
  const [addingAttach, setAddingAttach] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/portal/settings')
    if (res.ok) {
      const data = await res.json() as PortalSettings
      setSettings(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function update<K extends keyof PortalSettings>(key: K, value: PortalSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
    setSaved(false)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/portal/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: settings.company_name,
        company_phone: settings.company_phone,
        logo_url: settings.logo_url,
        header_notes: settings.header_notes,
        footer_notes: settings.footer_notes,
        show_inventory_button: settings.show_inventory_button,
        show_download_button: settings.show_download_button,
        show_materials_section: settings.show_materials_section,
        show_protection_section: settings.show_protection_section,
        require_deposit: settings.require_deposit,
        allow_accept_without_deposit: settings.allow_accept_without_deposit,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
    } else {
      const j = await res.json() as { error?: string }
      setError(j.error ?? 'Save failed')
    }
  }

  async function handleAddBadge() {
    if (!newBadgeName.trim()) return
    setAddingBadge(true)
    const res = await fetch('/api/admin/portal/settings/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBadgeName.trim(), image_url: newBadgeUrl.trim() || null }),
    })
    setAddingBadge(false)
    if (res.ok) {
      setNewBadgeName('')
      setNewBadgeUrl('')
      await load()
    }
  }

  async function handleDeleteBadge(id: string) {
    await fetch(`/api/admin/portal/settings/badges/${id}`, { method: 'DELETE' })
    await load()
  }

  async function handleAddAttachment() {
    if (!newAttachName.trim() || !newAttachUrl.trim()) return
    setAddingAttach(true)
    const res = await fetch('/api/admin/portal/settings/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newAttachName.trim(), file_url: newAttachUrl.trim() }),
    })
    setAddingAttach(false)
    if (res.ok) {
      setNewAttachName('')
      setNewAttachUrl('')
      await load()
    }
  }

  async function handleDeleteAttachment(id: string) {
    await fetch(`/api/admin/portal/settings/attachments/${id}`, { method: 'DELETE' })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
        <Loader2 size={16} className="animate-spin" /> Loading portal settings…
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Portal settings not found. Run the SQL from SCHEMA.md to create the <code>customer_portal_settings</code> table and seed the default row.
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Customer Portal</h1>
          <p className="text-sm text-slate-500 mt-0.5">Controls what customers see on their estimate portal.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          Settings saved.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Branding ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Branding</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <Field label="Company name">
            <input
              value={settings.company_name}
              onChange={e => update('company_name', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
            />
          </Field>
          <Field label="Phone number shown to customers">
            <input
              value={settings.company_phone}
              onChange={e => update('company_phone', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
            />
          </Field>
          <Field label="Custom logo URL (optional — defaults to Kratos logo)">
            <input
              value={settings.logo_url ?? ''}
              onChange={e => update('logo_url', e.target.value || null)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
            />
          </Field>
        </div>
      </section>

      {/* ── Notes ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Portal Notes</h2>
        <p className="text-xs text-slate-500">Merge tags you can use: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">{MERGE_TAG_HELP}</code></p>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <Field label="Header message (shown above estimate breakdown)">
            <textarea
              value={settings.header_notes ?? ''}
              onChange={e => update('header_notes', e.target.value || null)}
              rows={3}
              placeholder="Thank you {{customer_name}} for choosing us…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos resize-none"
            />
          </Field>
          <Field label="Footer message (shown at the bottom)">
            <textarea
              value={settings.footer_notes ?? ''}
              onChange={e => update('footer_notes', e.target.value || null)}
              rows={3}
              placeholder="Questions? Call us at {{company_phone}}…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos resize-none"
            />
          </Field>
        </div>
      </section>

      {/* ── Behavior ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Behavior</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <Toggle label="Show 'Manage Inventory' button" value={settings.show_inventory_button} onChange={v => update('show_inventory_button', v)} />
          <Toggle label="Show 'Download Estimate' button" value={settings.show_download_button} onChange={v => update('show_download_button', v)} />
          <Toggle label="Show Moving Materials section" value={settings.show_materials_section} onChange={v => update('show_materials_section', v)} />
          <Toggle label="Show Protection Options section" value={settings.show_protection_section} onChange={v => update('show_protection_section', v)} />
          <div className="border-t border-slate-100 pt-3" />
          <Toggle label="Require deposit to accept estimate" value={settings.require_deposit} onChange={v => update('require_deposit', v)} />
          <Toggle label="Allow customer to accept without paying deposit" value={settings.allow_accept_without_deposit} onChange={v => update('allow_accept_without_deposit', v)} />
        </div>
      </section>

      {/* ── Badges ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Awards &amp; Badges</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          {settings.badges.length === 0 && (
            <p className="text-sm text-slate-400">No badges added yet.</p>
          )}
          {settings.badges.map(badge => (
            <div key={badge.id} className="flex items-center gap-3">
              {badge.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={badge.image_url} alt={badge.name} className="h-8 w-8 rounded object-contain border border-slate-100" />
              )}
              <span className="flex-1 text-sm font-medium text-slate-900">{badge.name}</span>
              <button
                onClick={() => handleDeleteBadge(badge.id)}
                className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Add badge</p>
            <input
              value={newBadgeName}
              onChange={e => setNewBadgeName(e.target.value)}
              placeholder="e.g. Top Rated Mover 2024"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
            />
            <input
              value={newBadgeUrl}
              onChange={e => setNewBadgeUrl(e.target.value)}
              placeholder="Image URL (optional)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
            />
            <button
              onClick={handleAddBadge}
              disabled={addingBadge || !newBadgeName.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {addingBadge ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add badge
            </button>
          </div>
        </div>
      </section>

      {/* ── Attachments ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Attachments</h2>
        <p className="text-xs text-slate-500">Documents shown as download links on the estimate portal (e.g. Terms of Service, Valuation Guide).</p>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          {settings.attachments.length === 0 && (
            <p className="text-sm text-slate-400">No attachments added yet.</p>
          )}
          {settings.attachments.map(a => (
            <div key={a.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-medium text-slate-900">{a.name}</span>
              <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
              <button
                onClick={() => handleDeleteAttachment(a.id)}
                className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Add attachment</p>
            <input
              value={newAttachName}
              onChange={e => setNewAttachName(e.target.value)}
              placeholder="e.g. Terms of Service"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
            />
            <input
              value={newAttachUrl}
              onChange={e => setNewAttachUrl(e.target.value)}
              placeholder="File URL (https://...)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
            />
            <button
              onClick={handleAddAttachment}
              disabled={addingAttach || !newAttachName.trim() || !newAttachUrl.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {addingAttach ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add attachment
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-4"
    >
      <span className="text-sm text-slate-700">{label}</span>
      <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${value ? 'bg-kratos' : 'bg-slate-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
    </button>
  )
}
