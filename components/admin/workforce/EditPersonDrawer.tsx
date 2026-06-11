'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Loader2, Camera, Send, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resizeImage } from '@/lib/workforce/resize-image'
import { Avatar } from './Avatar'
import { ENGLISH_LEVELS } from './PeopleFilterBar'
import type { WorkforceRole, WorkforceLocation, WorkforceStatus, WorkforceTier, WorkforcePerson } from '@/lib/workforce/types'

interface Props {
  person: WorkforcePerson
  roles: WorkforceRole[]
  locations: WorkforceLocation[]
  statuses: WorkforceStatus[]
  tiers: WorkforceTier[]
  onUpdated: (updated: WorkforcePerson) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

async function uploadProfilePicture(file: File): Promise<string> {
  const resized = await resizeImage(file, 800, 0.85)
  const supabase = createClient()
  const fileName = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('workforce-photos').upload(fileName, resized, { upsert: false, cacheControl: '3600', contentType: 'image/jpeg' })
  if (error) throw new Error(error.message || 'Upload failed')
  const { data: { publicUrl } } = supabase.storage.from('workforce-photos').getPublicUrl(fileName)
  return publicUrl
}

export function EditPersonDrawer({ person, roles, locations, statuses, tiers, onUpdated, onDeleted, onClose }: Props) {
  const [name, setName] = useState(person.name)
  const [email, setEmail] = useState(person.email ?? '')
  const [phone, setPhone] = useState(person.phone ?? '')
  const [roleId, setRoleId] = useState(person.role_id ?? '')
  const [locationId, setLocationId] = useState(person.location_id ?? '')
  const [statusId, setStatusId] = useState(person.status_id ?? '')
  const [tierId, setTierId] = useState(person.tier_id ?? '')
  const [english, setEnglish] = useState(person.english_proficiency ?? '')
  const [notes, setNotes] = useState(person.notes ?? '')
  const [tenureStarted, setTenureStarted] = useState(person.tenure_started_at ?? '')
  const [referredBy, setReferredBy] = useState(person.referred_by ?? '')
  const [pictureUrl, setPictureUrl] = useState(person.profile_picture_url ?? null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(person.profile_picture_url ?? null)
  const [hasAppAccess, setHasAppAccess] = useState(Boolean(person.profile_id))

  const [saving, setSaving] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when person ID changes — intentionally only person.id in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setName(person.name)
    setRoleId(person.role_id ?? '')
    setLocationId(person.location_id ?? '')
    setStatusId(person.status_id ?? '')
    setTierId(person.tier_id ?? '')
    setEnglish(person.english_proficiency ?? '')
    setEmail(person.email ?? '')
    setPhone(person.phone ?? '')
    setNotes(person.notes ?? '')
    setTenureStarted(person.tenure_started_at ?? '')
    setReferredBy(person.referred_by ?? '')
    setPictureUrl(person.profile_picture_url ?? null)
    setPreviewUrl(person.profile_picture_url ?? null)
    setPendingFile(null)
    setError(null)
    setConfirmDelete(false)
    setHasAppAccess(Boolean(person.profile_id))
    setInviteSent(false)
  }, [person.id])

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)

    let finalPictureUrl = pictureUrl
    if (pendingFile) {
      try {
        finalPictureUrl = await uploadProfilePicture(pendingFile)
      } catch (err) {
        setError(`Photo upload failed: ${err instanceof Error ? err.message : 'Unknown error'}. Try a different image.`)
        setSaving(false)
        return
      }
    }

    const res = await fetch(`/api/admin/workforce/people/${person.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role_id: roleId || null,
        location_id: locationId || null,
        status_id: statusId || null,
        tier_id: tierId || null,
        english_proficiency: english || null,
        profile_picture_url: finalPictureUrl,
        notes: notes.trim() || null,
        tenure_started_at: tenureStarted || null,
        referred_by: referredBy.trim() || null,
      }),
    })

    if (res.ok) {
      const updated = await res.json() as WorkforcePerson
      onUpdated(updated)
      onClose()
    } else {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Failed to save')
    }
    setSaving(false)
  }

  async function handleSendInvite() {
    if (!email.trim()) { setError('Add an email address first, then save, before sending the invite.'); return }
    setSendingInvite(true)
    setError(null)
    const res = await fetch(`/api/admin/workforce/people/${person.id}/invite`, { method: 'POST' })
    const j = await res.json().catch(() => ({}))
    if (res.ok) {
      setInviteSent(true)
      setHasAppAccess(true)
    } else {
      setError(j.error || 'Failed to send invite')
    }
    setSendingInvite(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/admin/workforce/people/${person.id}`, { method: 'DELETE' })
    if (res.ok) {
      onDeleted(person.id)
      onClose()
    } else {
      setError('Delete failed')
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <h2 className="text-base font-bold text-slate-900">Edit Person</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Avatar + change photo */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar src={previewUrl} name={name || person.name} size="lg" />
              <label
                htmlFor="edit-profile-picture"
                className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 cursor-pointer transition-all"
                title="Change photo"
              >
                <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </label>
              <input
                type="file"
                accept="image/*"
                id="edit-profile-picture"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) { setPendingFile(file); setPreviewUrl(URL.createObjectURL(file)) }
                }}
              />
            </div>
            <div>
              <p className="text-xs text-slate-500">Hover to change photo</p>
              {pendingFile && (
                <button
                  type="button"
                  onClick={() => { setPendingFile(null); setPreviewUrl(pictureUrl) }}
                  className="text-xs text-slate-500 hover:text-slate-700 mt-1"
                >
                  Revert photo
                </button>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Crew App Access — email, phone, invite */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">Crew App Access</p>
              {hasAppAccess && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  <CheckCircle2 size={10} /> Active
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="crew@email.com"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(416) 555-0100"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendInvite}
              disabled={sendingInvite}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60 transition-colors"
            >
              {sendingInvite
                ? <><Loader2 size={12} className="animate-spin" /> Sending...</>
                : inviteSent
                  ? <><CheckCircle2 size={12} className="text-green-400" /> Sent — click to resend</>
                  : <><Send size={12} /> {hasAppAccess ? 'Resend App Invite' : 'Send App Invite'}</>
              }
            </button>
            <p className="text-[11px] text-slate-400">
              Sends a login link to the crew member&apos;s email. They set their own password and log into the Kratos Crew app.
            </p>
          </div>

          {/* Row: Role + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
              <select value={roleId} onChange={e => setRoleId(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                <option value="">— No role —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                <option value="">— No location —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Status + Tier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select value={statusId} onChange={e => setStatusId(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                <option value="">— No status —</option>
                {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tier</label>
              <select value={tierId} onChange={e => setTierId(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                <option value="">— No tier —</option>
                {tiers.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* English */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">English Proficiency</label>
            <select value={english} onChange={e => setEnglish(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
              <option value="">— Not specified —</option>
              {ENGLISH_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>

          {/* Row: Tenure + Referred by */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tenure started</label>
              <input
                type="date"
                value={tenureStarted}
                onChange={e => setTenureStarted(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Referred by</label>
              <input
                type="text"
                value={referredBy}
                onChange={e => setReferredBy(e.target.value)}
                placeholder="Name"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Internal notes..."
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700 font-medium">Delete {person.name}? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting && <Loader2 size={13} className="animate-spin" />}
                  Yes, delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
              >
                <Trash2 size={14} /> Delete person
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-kratos text-slate-950 rounded-md hover:opacity-90 disabled:opacity-60"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
