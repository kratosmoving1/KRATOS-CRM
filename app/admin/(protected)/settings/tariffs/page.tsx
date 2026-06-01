'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Loader2, ChevronRight, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local: 'Local',
  long_distance: 'Long Distance',
  commercial: 'Commercial',
  international: 'International',
  packing: 'Packing',
  storage: 'Storage',
}

interface TariffProfile {
  id: string
  name: string
  service_type: string
  min_booking_amount: number
  is_active: boolean
  created_at: string
}

export default function TariffLibraryPage() {
  const [profiles, setProfiles] = useState<TariffProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addServiceType, setAddServiceType] = useState('local')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tariffs/profiles')
      if (res.ok) setProfiles(await res.json())
    } catch {
      toast.error('Failed to load tariff profiles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addProfile() {
    if (!addName.trim()) { toast.error('Enter a tariff name'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/admin/tariffs/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName.trim(), service_type: addServiceType }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to create tariff'); return }
      toast.success('Tariff profile created.')
      setAddName('')
      setAddServiceType('local')
      setShowAddForm(false)
      await load()
    } catch {
      toast.error('Network error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Settings / Tariffs</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Tariff Library</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage move packages and pricing. Rates auto-populate when agents apply a package on the Estimate tab.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(v => !v)}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-kratos px-4 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-90"
        >
          <Plus size={16} /> Add Tariff
        </button>
      </div>

      {/* DB not configured notice */}
      {!loading && profiles.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <p className="font-semibold">No tariff profiles found in the database.</p>
          <p className="mt-1">Run the SQL setup in Supabase SQL Editor to create the tariff tables and seed the default Local Moving profile with Silver and Gold packages.</p>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">New Tariff Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Tariff Name</label>
              <input
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="e.g. Local Moving"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                onKeyDown={e => { if (e.key === 'Enter') addProfile() }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Applies To</label>
              <select
                value={addServiceType}
                onChange={e => setAddServiceType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos"
              >
                {Object.entries(SERVICE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddName('') }}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addProfile}
              disabled={adding || !addName.trim()}
              className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
            >
              {adding && <Loader2 size={14} className="animate-spin" />}
              Create Tariff
            </button>
          </div>
        </div>
      )}

      {/* Tariff cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : profiles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {profiles.map(profile => (
            <Link
              key={profile.id}
              href={`/admin/settings/tariffs/${profile.id}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-kratos/50 hover:shadow-md"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-kratos/10 group-hover:text-kratos transition-colors">
                  <Tag size={18} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950 truncate">{profile.name}</p>
                  <p className="text-xs text-slate-500">
                    {SERVICE_TYPE_LABELS[profile.service_type] ?? profile.service_type} moves
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                  profile.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
                )}>
                  {profile.is_active ? 'Active' : 'Inactive'}
                </span>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-kratos transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
