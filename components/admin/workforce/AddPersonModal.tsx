'use client'

import { useState } from 'react'
import { X, Camera, Upload, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resizeImage } from '@/lib/workforce/resize-image'
import type { WorkforceRole, WorkforceLocation, WorkforceStatus, WorkforceTier, WorkforcePerson } from '@/lib/workforce/types'
import { ENGLISH_LEVELS } from './PeopleFilterBar'

interface Props {
  roles: WorkforceRole[]
  locations: WorkforceLocation[]
  statuses: WorkforceStatus[]
  tiers: WorkforceTier[]
  onCreated: (person: WorkforcePerson) => void
  onClose: () => void
}

async function uploadProfilePicture(file: File): Promise<string> {
  const resized = await resizeImage(file, 800, 0.85)
  const supabase = createClient()
  const fileName = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('workforce-photos')
    .upload(fileName, resized, { upsert: false, cacheControl: '3600', contentType: 'image/jpeg' })
  if (error) throw new Error(error.message || 'Upload failed')
  const { data: { publicUrl } } = supabase.storage.from('workforce-photos').getPublicUrl(fileName)
  return publicUrl
}

export function AddPersonModal({ roles, locations, statuses, tiers, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [statusId, setStatusId] = useState('')
  const [tierId, setTierId] = useState('')
  const [english, setEnglish] = useState('')
  const [notes, setNotes] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    setSubmitting(true)
    setError(null)

    let profile_picture_url: string | null = null
    if (pendingFile) {
      try {
        profile_picture_url = await uploadProfilePicture(pendingFile)
      } catch (err) {
        setError(`Photo upload failed: ${err instanceof Error ? err.message : 'Unknown error'}. Try a different image.`)
        setSubmitting(false)
        return
      }
    }

    const res = await fetch('/api/admin/workforce/people', {
      method: 'POST',
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
        profile_picture_url,
        notes: notes.trim() || null,
      }),
    })

    if (res.ok) {
      const person = await res.json() as WorkforcePerson
      onCreated(person)
      onClose()
    } else {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Failed to add person')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Add Person</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

            {/* Profile picture */}
            <div className="flex items-center gap-4">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                  <Camera className="w-8 h-8" />
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  id="profile-picture-input"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) { setPendingFile(file); setPreviewUrl(URL.createObjectURL(file)) }
                  }}
                />
                <label
                  htmlFor="profile-picture-input"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Choose Photo
                </label>
                {pendingFile && (
                  <button
                    type="button"
                    onClick={() => { setPendingFile(null); setPreviewUrl(null) }}
                    className="ml-2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Remove
                  </button>
                )}
                <p className="text-[10px] text-slate-400 mt-1">JPEG, PNG, WebP · max 5MB</p>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(false) }}
                placeholder="Full name"
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${nameError ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
              />
              {nameError && <p className="text-xs text-red-500 mt-1">Name is required</p>}
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="crew@email.com"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(416) 555-0100"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
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

            {/* English proficiency */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">English Proficiency</label>
              <select value={english} onChange={e => setEnglish(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                <option value="">— Not specified —</option>
                {ENGLISH_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
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
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-kratos text-slate-950 rounded-md hover:opacity-90 disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Add Person
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
