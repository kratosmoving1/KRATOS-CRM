'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AlignLeft, Building2, ChevronDown, ChevronRight, ChevronUp,
  Eye, EyeOff, GripVertical, Image as ImageIcon, Loader2,
  Plus, Save, Share2, Trash2, X,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PortalAttachment { id: string; name: string; file_url: string; position: number }
interface PortalBadge      { id: string; name: string; image_url: string | null; position: number }
interface ContentBlock {
  id: string
  section_type: 'rich_text' | 'photo_gallery' | 'social_links' | 'company_logos'
  title: string | null
  body: string | null
  data: Record<string, unknown>
  position: number
  is_visible: boolean
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
  content_blocks: ContentBlock[]
}

const MERGE_TAG_HELP = '{{customer_name}}  {{quote_number}}  {{move_date}}  {{company_phone}}  {{origin_city}}  {{destination_city}}'

const BLOCK_TYPE_LABELS: Record<string, string> = {
  rich_text:     'Rich Text',
  photo_gallery: 'Photo Gallery',
  social_links:  'Social Links',
  company_logos: 'Company Logos',
}

const BLOCK_TYPE_ICONS: Record<string, React.ReactNode> = {
  rich_text:     <AlignLeft size={14} />,
  photo_gallery: <ImageIcon size={14} />,
  social_links:  <Share2 size={14} />,
  company_logos: <Building2 size={14} />,
}

const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'twitter']

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortalSettingsPage() {
  const [settings, setSettings] = useState<PortalSettings | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Badge form
  const [newBadgeName, setNewBadgeName] = useState('')
  const [newBadgeUrl, setNewBadgeUrl]   = useState('')
  const [addingBadge, setAddingBadge]   = useState(false)

  // Attachment form
  const [newAttachName, setNewAttachName] = useState('')
  const [newAttachUrl, setNewAttachUrl]   = useState('')
  const [addingAttach, setAddingAttach]   = useState(false)

  // Content block add modal
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [newBlockType, setNewBlockType] = useState<ContentBlock['section_type']>('rich_text')
  const [newBlockTitle, setNewBlockTitle] = useState('')
  const [newBlockBody, setNewBlockBody]   = useState('')
  const [newBlockData, setNewBlockData]   = useState<Record<string, unknown>>({})
  const [addingBlock, setAddingBlock]     = useState(false)

  // Content block edit
  const [editingBlock, setEditingBlock] = useState<string | null>(null)
  const [editTitle, setEditTitle]       = useState('')
  const [editBody, setEditBody]         = useState('')
  const [editData, setEditData]         = useState<Record<string, unknown>>({})
  const [savingBlock, setSavingBlock]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/portal/settings')
    if (res.ok) setSettings(await res.json() as PortalSettings)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function update<K extends keyof PortalSettings>(key: K, value: PortalSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
    setSaved(false)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true); setError(null)
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
    if (res.ok) setSaved(true)
    else {
      const j = await res.json() as { error?: string }
      setError(j.error ?? 'Save failed')
    }
  }

  // ── Badges ────────────────────────────────────────────────────────────────

  async function handleAddBadge() {
    if (!newBadgeName.trim()) return
    setAddingBadge(true)
    await fetch('/api/admin/portal/settings/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBadgeName.trim(), image_url: newBadgeUrl.trim() || null }),
    })
    setAddingBadge(false)
    setNewBadgeName(''); setNewBadgeUrl('')
    await load()
  }

  async function handleDeleteBadge(id: string) {
    await fetch(`/api/admin/portal/settings/badges/${id}`, { method: 'DELETE' })
    await load()
  }

  // ── Attachments ───────────────────────────────────────────────────────────

  async function handleAddAttachment() {
    if (!newAttachName.trim() || !newAttachUrl.trim()) return
    setAddingAttach(true)
    await fetch('/api/admin/portal/settings/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newAttachName.trim(), file_url: newAttachUrl.trim() }),
    })
    setAddingAttach(false)
    setNewAttachName(''); setNewAttachUrl('')
    await load()
  }

  async function handleDeleteAttachment(id: string) {
    await fetch(`/api/admin/portal/settings/attachments/${id}`, { method: 'DELETE' })
    await load()
  }

  // ── Content blocks ────────────────────────────────────────────────────────

  function resetAddBlockForm() {
    setNewBlockTitle('')
    setNewBlockBody('')
    setNewBlockData({})
    setNewBlockType('rich_text')
  }

  async function handleAddBlock() {
    setAddingBlock(true)
    const res = await fetch('/api/admin/portal/settings/content-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_type: newBlockType,
        title: newBlockTitle.trim() || null,
        body: newBlockBody.trim() || null,
        data: newBlockData,
      }),
    })
    setAddingBlock(false)
    if (res.ok) {
      setShowAddBlock(false)
      resetAddBlockForm()
      await load()
    }
  }

  function startEdit(block: ContentBlock) {
    setEditingBlock(block.id)
    setEditTitle(block.title ?? '')
    setEditBody(block.body ?? '')
    setEditData(block.data ?? {})
  }

  async function handleSaveBlock(id: string) {
    setSavingBlock(true)
    await fetch(`/api/admin/portal/settings/content-blocks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle || null, body: editBody || null, data: editData }),
    })
    setSavingBlock(false)
    setEditingBlock(null)
    await load()
  }

  async function handleToggleBlock(id: string, visible: boolean) {
    await fetch(`/api/admin/portal/settings/content-blocks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: visible }),
    })
    setSettings(prev => prev ? {
      ...prev,
      content_blocks: prev.content_blocks.map(b => b.id === id ? { ...b, is_visible: visible } : b),
    } : prev)
  }

  async function handleDeleteBlock(id: string) {
    await fetch(`/api/admin/portal/settings/content-blocks/${id}`, { method: 'DELETE' })
    setSettings(prev => prev ? {
      ...prev,
      content_blocks: prev.content_blocks.filter(b => b.id !== id),
    } : prev)
  }

  async function handleMoveBlock(id: string, dir: 'up' | 'down') {
    if (!settings) return
    const blocks = [...settings.content_blocks].sort((a, b) => a.position - b.position)
    const idx = blocks.findIndex(b => b.id === id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= blocks.length) return

    const a = blocks[idx], b = blocks[swapIdx]
    await Promise.all([
      fetch(`/api/admin/portal/settings/content-blocks/${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: b.position }),
      }),
      fetch(`/api/admin/portal/settings/content-blocks/${b.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: a.position }),
      }),
    ])
    await load()
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        Portal settings not found. Run the SQL from SCHEMA.md to create the <code>customer_portal_settings</code> table.
      </div>
    )
  }

  const sortedBlocks = [...(settings.content_blocks ?? [])].sort((a, b) => a.position - b.position)

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Header ── */}
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

      {saved && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">Settings saved.</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* ── Branding ── */}
      <Section title="Branding">
        <Field label="Company name">
          <Input value={settings.company_name} onChange={v => update('company_name', v)} />
        </Field>
        <Field label="Phone number shown to customers">
          <Input value={settings.company_phone} onChange={v => update('company_phone', v)} />
        </Field>
        <Field label="Custom logo URL (optional)">
          <Input value={settings.logo_url ?? ''} onChange={v => update('logo_url', v || null)} placeholder="https://..." />
        </Field>
      </Section>

      {/* ── Notes ── */}
      <Section title="Portal Notes">
        <p className="text-xs text-slate-500">
          Merge tags: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">{MERGE_TAG_HELP}</code>
        </p>
        <p className="text-xs text-slate-500">
          In the message, <strong>{'{{customer_name}}'}</strong> renders bold orange.
          A line of dashes (——) renders as an orange divider.
        </p>
        <Field label="Header message (personalized text above estimate)">
          <Textarea
            value={settings.header_notes ?? ''}
            onChange={v => update('header_notes', v || null)}
            rows={5}
            placeholder={"{{customer_name}} — your Kratos move is in motion. Review your estimate below. When you're ready to lock it in, click Accept Estimate. We'll handle the rest.\n\n——————————\nΚράτος · Done As Promised."}
          />
        </Field>
        <Field label="Footer message (shown below estimate breakdown)">
          <Textarea
            value={settings.footer_notes ?? ''}
            onChange={v => update('footer_notes', v || null)}
            rows={3}
            placeholder="Questions? Call us at {{company_phone}}"
          />
        </Field>
      </Section>

      {/* ── Behavior ── */}
      <Section title="Behavior">
        <Toggle label="Show 'Manage Inventory' button" value={settings.show_inventory_button} onChange={v => update('show_inventory_button', v)} />
        <Toggle label="Show 'Download Estimate' button" value={settings.show_download_button} onChange={v => update('show_download_button', v)} />
        <Toggle label="Show Moving Materials section" value={settings.show_materials_section} onChange={v => update('show_materials_section', v)} />
        <Toggle label="Show Protection Options section" value={settings.show_protection_section} onChange={v => update('show_protection_section', v)} />
        <div className="border-t border-slate-100 pt-3" />
        <Toggle label="Require deposit to accept estimate" value={settings.require_deposit} onChange={v => update('require_deposit', v)} />
        <Toggle label="Allow customer to accept without paying deposit" value={settings.allow_accept_without_deposit} onChange={v => update('allow_accept_without_deposit', v)} />
      </Section>

      {/* ── Awards & Badges ── */}
      <Section title="Awards & Badges" description="Certification badges shown as a row of images below the personalized message.">
        {settings.badges.length === 0 && <p className="text-sm text-slate-400">No badges added yet.</p>}
        {settings.badges.map(badge => (
          <div key={badge.id} className="flex items-center gap-3">
            {badge.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={badge.image_url} alt={badge.name} className="h-9 w-9 rounded object-contain border border-slate-100" />
            )}
            <span className="flex-1 text-sm font-medium text-slate-900">{badge.name}</span>
            <button onClick={() => handleDeleteBadge(badge.id)} className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500">Add badge</p>
          <Input value={newBadgeName} onChange={setNewBadgeName} placeholder="e.g. Top Rated Mover 2024" />
          <Input value={newBadgeUrl} onChange={setNewBadgeUrl} placeholder="Badge image URL (https://...)" />
          <button
            onClick={handleAddBadge}
            disabled={addingBadge || !newBadgeName.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {addingBadge ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add badge
          </button>
        </div>
      </Section>

      {/* ── Attachments ── */}
      <Section title="Attachments" description="Documents shown as download links on the portal (Terms of Service, Valuation Guide, etc.).">
        {settings.attachments.length === 0 && <p className="text-sm text-slate-400">No attachments added yet.</p>}
        {settings.attachments.map(a => (
          <div key={a.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm font-medium text-slate-900">{a.name}</span>
            <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
            <button onClick={() => handleDeleteAttachment(a.id)} className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500">Add attachment</p>
          <Input value={newAttachName} onChange={setNewAttachName} placeholder="e.g. Terms of Service" />
          <Input value={newAttachUrl} onChange={setNewAttachUrl} placeholder="File URL (https://...)" />
          <button
            onClick={handleAddAttachment}
            disabled={addingAttach || !newAttachName.trim() || !newAttachUrl.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {addingAttach ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add attachment
          </button>
        </div>
      </Section>

      {/* ── Content Blocks ── */}
      <Section title="Content Blocks" description="Custom sections that appear at the bottom of the portal — rich text, photos, social links, company logos.">

        {sortedBlocks.length === 0 && (
          <p className="text-sm text-slate-400">No content blocks yet. Add one below.</p>
        )}

        {sortedBlocks.map((block, idx) => {
          const isEditing = editingBlock === block.id
          return (
            <div key={block.id} className="rounded-xl border border-slate-200 overflow-hidden">
              {/* Block header row */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50">
                <GripVertical size={14} className="text-slate-300 shrink-0" />
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  {BLOCK_TYPE_ICONS[block.section_type]}
                  {BLOCK_TYPE_LABELS[block.section_type]}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-800 truncate">
                  {block.title || <em className="text-slate-400 font-normal">Untitled</em>}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Move up/down */}
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveBlock(block.id, 'up')}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30"
                  ><ChevronUp size={13} /></button>
                  <button
                    disabled={idx === sortedBlocks.length - 1}
                    onClick={() => handleMoveBlock(block.id, 'down')}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30"
                  ><ChevronDown size={13} /></button>
                  {/* Visibility */}
                  <button
                    onClick={() => handleToggleBlock(block.id, !block.is_visible)}
                    className={`p-1 rounded hover:bg-slate-200 ${block.is_visible ? 'text-slate-500' : 'text-slate-300'}`}
                    title={block.is_visible ? 'Visible — click to hide' : 'Hidden — click to show'}
                  >
                    {block.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  {/* Edit toggle */}
                  <button
                    onClick={() => isEditing ? setEditingBlock(null) : startEdit(block)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                  >
                    {isEditing ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50"
                  ><Trash2 size={13} /></button>
                </div>
              </div>

              {/* Edit form */}
              {isEditing && (
                <div className="px-4 py-4 border-t border-slate-100 space-y-3 bg-white">
                  <Field label="Title">
                    <Input value={editTitle} onChange={setEditTitle} placeholder="Section heading (shown in orange)" />
                  </Field>

                  {(block.section_type === 'rich_text' || block.section_type === 'company_logos') && (
                    <Field label={block.section_type === 'company_logos' ? 'Description' : 'Body text'}>
                      <Textarea
                        value={editBody}
                        onChange={setEditBody}
                        rows={block.section_type === 'rich_text' ? 6 : 2}
                        placeholder={block.section_type === 'rich_text'
                          ? 'Body text. Use **bold** and *italic*. New line = new paragraph.\n\ni. First bullet item\nii. Second bullet item'
                          : 'Short description under the title'}
                      />
                    </Field>
                  )}

                  {block.section_type === 'photo_gallery' && (
                    <PhotoDataEditor data={editData} onChange={setEditData} />
                  )}

                  {block.section_type === 'social_links' && (
                    <SocialDataEditor data={editData} onChange={setEditData} />
                  )}

                  {block.section_type === 'company_logos' && (
                    <LogoDataEditor data={editData} onChange={setEditData} />
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleSaveBlock(block.id)}
                      disabled={savingBlock}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingBlock ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save block
                    </button>
                    <button
                      onClick={() => setEditingBlock(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Add block button / form */}
        {!showAddBlock ? (
          <button
            onClick={() => { setShowAddBlock(true); resetAddBlockForm() }}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Plus size={14} /> Add content block
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">New content block</p>
              <button onClick={() => setShowAddBlock(false)} className="text-slate-400 hover:text-slate-700 p-0.5 rounded">
                <X size={15} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              {/* Type selector */}
              <Field label="Block type">
                <div className="grid grid-cols-2 gap-2">
                  {(['rich_text', 'photo_gallery', 'social_links', 'company_logos'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => { setNewBlockType(type); setNewBlockData({}) }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        newBlockType === type
                          ? 'border-kratos bg-kratos/5 text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {BLOCK_TYPE_ICONS[type]}
                      {BLOCK_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Title">
                <Input value={newBlockTitle} onChange={setNewBlockTitle} placeholder="Section heading (shown in orange)" />
              </Field>

              {(newBlockType === 'rich_text' || newBlockType === 'company_logos') && (
                <Field label={newBlockType === 'company_logos' ? 'Description' : 'Body text'}>
                  <Textarea
                    value={newBlockBody}
                    onChange={setNewBlockBody}
                    rows={newBlockType === 'rich_text' ? 5 : 2}
                    placeholder={newBlockType === 'rich_text'
                      ? "Body text. Use **bold** and *italic*.\n\ni. First bullet\nii. Second bullet"
                      : 'Short description'}
                  />
                </Field>
              )}

              {newBlockType === 'photo_gallery' && (
                <PhotoDataEditor data={newBlockData} onChange={setNewBlockData} />
              )}
              {newBlockType === 'social_links' && (
                <SocialDataEditor data={newBlockData} onChange={setNewBlockData} />
              )}
              {newBlockType === 'company_logos' && (
                <LogoDataEditor data={newBlockData} onChange={setNewBlockData} />
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddBlock}
                  disabled={addingBlock}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {addingBlock ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add block
                </button>
                <button
                  onClick={() => setShowAddBlock(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        {children}
      </div>
    </section>
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

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos resize-none"
    />
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-4">
      <span className="text-sm text-slate-700">{label}</span>
      <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${value ? 'bg-kratos' : 'bg-slate-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
      </div>
    </button>
  )
}

// ── Data editors for each block type ──────────────────────────────────────────

function PhotoDataEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const images = (data.images ?? []) as Array<{ url: string; alt?: string }>
  const [newUrl, setNewUrl] = useState('')
  const [newAlt, setNewAlt] = useState('')

  function addImage() {
    if (!newUrl.trim()) return
    onChange({ ...data, images: [...images, { url: newUrl.trim(), alt: newAlt.trim() || undefined }] })
    setNewUrl(''); setNewAlt('')
  }

  function removeImage(i: number) {
    onChange({ ...data, images: images.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500">Photos</p>
      {images.map((img, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.alt ?? ''} className="h-10 w-14 rounded object-cover border border-slate-100 shrink-0" />
          <span className="flex-1 text-xs text-slate-600 truncate">{img.url}</span>
          <button onClick={() => removeImage(i)} className="text-slate-300 hover:text-red-500 shrink-0">
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Image URL (https://...)"
          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-kratos" />
        <input value={newAlt} onChange={e => setNewAlt(e.target.value)} placeholder="Alt text"
          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-kratos" />
        <button onClick={addImage} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
          Add
        </button>
      </div>
    </div>
  )
}

function SocialDataEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const links = (data.links ?? []) as Array<{ platform: string; url: string }>
  const [newPlatform, setNewPlatform] = useState('instagram')
  const [newUrl, setNewUrl] = useState('')

  function addLink() {
    if (!newUrl.trim()) return
    // Remove existing entry for same platform
    const filtered = links.filter(l => l.platform !== newPlatform)
    onChange({ ...data, links: [...filtered, { platform: newPlatform, url: newUrl.trim() }] })
    setNewUrl('')
  }

  function removeLink(platform: string) {
    onChange({ ...data, links: links.filter(l => l.platform !== platform) })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500">Social links</p>
      {links.map(link => (
        <div key={link.platform} className="flex items-center gap-2">
          <span className="w-20 text-xs font-semibold capitalize text-slate-600">{link.platform}</span>
          <span className="flex-1 text-xs text-slate-500 truncate">{link.url}</span>
          <button onClick={() => removeLink(link.platform)} className="text-slate-300 hover:text-red-500">
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <select
          value={newPlatform}
          onChange={e => setNewPlatform(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-kratos"
        >
          {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <input
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          placeholder="https://instagram.com/kratosmoving"
          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-kratos"
        />
        <button onClick={addLink} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
          Add
        </button>
      </div>
    </div>
  )
}

function LogoDataEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const logos = (data.logos ?? []) as Array<{ url: string; name?: string }>
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')

  function addLogo() {
    if (!newUrl.trim()) return
    onChange({ ...data, logos: [...logos, { url: newUrl.trim(), name: newName.trim() || undefined }] })
    setNewUrl(''); setNewName('')
  }

  function removeLogo(i: number) {
    onChange({ ...data, logos: logos.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500">Company logos</p>
      {logos.map((logo, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.url} alt={logo.name ?? ''} className="h-10 w-14 rounded object-contain border border-slate-100 shrink-0" />
          <span className="flex-1 text-xs text-slate-600 truncate">{logo.name || logo.url}</span>
          <button onClick={() => removeLogo(i)} className="text-slate-300 hover:text-red-500 shrink-0">
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Logo URL (https://...)"
          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-kratos" />
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (optional)"
          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-kratos" />
        <button onClick={addLogo} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
          Add
        </button>
      </div>
    </div>
  )
}
