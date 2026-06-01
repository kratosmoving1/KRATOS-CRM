'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Plus, Pencil, Trash2, X, Check,
  Truck, Users, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local: 'Local', long_distance: 'Long Distance', commercial: 'Commercial',
  international: 'International', packing: 'Packing', storage: 'Storage',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function numVal(v: string): number {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

interface TariffProfile {
  id: string
  name: string
  service_type: string
  min_booking_amount: number
  is_active: boolean
}

interface TariffPackage {
  id: string
  profile_id: string
  name: string
  description: string | null
  num_trucks: number
  num_crew: number
  weekday_rate: number
  weekend_rate: number
  minimum_hours: number
  is_active: boolean
  sort_order: number
}

type Section = 'setup' | 'rates'

// ─── Inline rate field ────────────────────────────────────────────────────────

function RateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus-within:border-kratos focus-within:ring-1 focus-within:ring-kratos/20">
      <span className="mr-1 text-xs text-slate-400">$</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-20 bg-transparent text-sm font-semibold text-slate-900 outline-none"
      />
    </div>
  )
}

function NumInput({ value, onChange, min = 0, step = 1 }: { value: string; onChange: (v: string) => void; min?: number; step?: number }) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-kratos focus:ring-1 focus:ring-kratos/20"
    />
  )
}

// ─── Package row (view + edit inline) ────────────────────────────────────────

function PackageRow({
  pkg,
  onSave,
  onDelete,
  onToggle,
}: {
  pkg: TariffPackage
  onSave: (id: string, update: Partial<TariffPackage>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggle: (id: string, active: boolean) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(pkg.name)
  const [description, setDescription] = useState(pkg.description ?? '')
  const [trucks, setTrucks] = useState(String(pkg.num_trucks))
  const [crew, setCrew] = useState(String(pkg.num_crew))
  const [weekday, setWeekday] = useState(String(pkg.weekday_rate))
  const [weekend, setWeekend] = useState(String(pkg.weekend_rate))
  const [minH, setMinH] = useState(String(pkg.minimum_hours))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    if (!name.trim()) { toast.error('Package name is required'); return }
    setSaving(true)
    await onSave(pkg.id, {
      name: name.trim(),
      description: description.trim() || null,
      num_trucks: numVal(trucks),
      num_crew: numVal(crew),
      weekday_rate: numVal(weekday),
      weekend_rate: numVal(weekend),
      minimum_hours: numVal(minH),
    })
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setName(pkg.name)
    setDescription(pkg.description ?? '')
    setTrucks(String(pkg.num_trucks))
    setCrew(String(pkg.num_crew))
    setWeekday(String(pkg.weekday_rate))
    setWeekend(String(pkg.weekend_rate))
    setMinH(String(pkg.minimum_hours))
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-kratos/5 border-l-2 border-kratos">
        <td className="px-4 py-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-kratos"
            placeholder="Package name"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 outline-none focus:border-kratos"
            placeholder="Description (optional)"
          />
        </td>
        <td className="px-4 py-3"><NumInput value={trucks} onChange={setTrucks} min={1} /></td>
        <td className="px-4 py-3"><NumInput value={crew} onChange={setCrew} min={1} /></td>
        <td className="px-4 py-3"><RateInput value={weekday} onChange={setWeekday} /></td>
        <td className="px-4 py-3"><RateInput value={weekend} onChange={setWeekend} /></td>
        <td className="px-4 py-3"><NumInput value={minH} onChange={setMinH} min={0} step={0.5} /></td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-kratos px-3 py-1.5 text-xs font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save
            </button>
            <button type="button" onClick={cancel} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
              <X size={12} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={cn('group transition-colors hover:bg-slate-50/60', !pkg.is_active && 'opacity-50')}>
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-900">{pkg.name}</p>
        {pkg.description && <p className="text-xs text-slate-500">{pkg.description}</p>}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        <span className="flex items-center gap-1"><Truck size={12} className="text-slate-400" />{pkg.num_trucks}</span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        <span className="flex items-center gap-1"><Users size={12} className="text-slate-400" />{pkg.num_crew}</span>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{fmt(pkg.weekday_rate)}<span className="font-normal text-slate-400">/hr</span></td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{fmt(pkg.weekend_rate)}<span className="font-normal text-slate-400">/hr</span></td>
      <td className="px-4 py-3 text-sm text-slate-700">{pkg.minimum_hours}h min</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {/* Active toggle */}
          <button
            type="button"
            onClick={() => onToggle(pkg.id, !pkg.is_active)}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
              pkg.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
            )}
          >
            {pkg.is_active ? 'Active' : 'Inactive'}
          </button>
          <button type="button" onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
            <Pencil size={12} />
          </button>
          {confirmDelete ? (
            <>
              <button type="button" onClick={() => onDelete(pkg.id)}
                className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">
                Confirm
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-100 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Add Package row ──────────────────────────────────────────────────────────

function AddPackageRow({ onAdd }: { onAdd: (pkg: Omit<TariffPackage, 'id' | 'profile_id' | 'is_active' | 'sort_order'>) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [trucks, setTrucks] = useState('1')
  const [crew, setCrew] = useState('2')
  const [weekday, setWeekday] = useState('')
  const [weekend, setWeekend] = useState('')
  const [minH, setMinH] = useState('3')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!name.trim()) { toast.error('Package name is required'); return }
    if (!weekday || !weekend) { toast.error('Enter weekday and weekend rates'); return }
    setSaving(true)
    await onAdd({
      name: name.trim(),
      description: description.trim() || null,
      num_trucks: numVal(trucks),
      num_crew: numVal(crew),
      weekday_rate: numVal(weekday),
      weekend_rate: numVal(weekend),
      minimum_hours: numVal(minH),
    })
    setName(''); setDescription(''); setTrucks('1'); setCrew('2'); setWeekday(''); setWeekend(''); setMinH('3')
    setSaving(false)
    setOpen(false)
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3">
          <button type="button" onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-kratos hover:underline">
            <Plus size={14} /> Add Package
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-green-50/50 border-l-2 border-green-400">
      <td className="px-4 py-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Package name *"
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-kratos" />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description"
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-kratos" />
      </td>
      <td className="px-4 py-3"><NumInput value={trucks} onChange={setTrucks} min={1} /></td>
      <td className="px-4 py-3"><NumInput value={crew} onChange={setCrew} min={1} /></td>
      <td className="px-4 py-3"><RateInput value={weekday} onChange={setWeekday} /></td>
      <td className="px-4 py-3"><RateInput value={weekend} onChange={setWeekend} /></td>
      <td className="px-4 py-3"><NumInput value={minH} onChange={setMinH} min={0} step={0.5} /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={add} disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-kratos px-3 py-1.5 text-xs font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Add
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
            <X size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TariffProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [profile, setProfile] = useState<TariffProfile | null>(null)
  const [packages, setPackages] = useState<TariffPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<Section>('rates')

  // Profile edit state
  const [editName, setEditName] = useState('')
  const [editServiceType, setEditServiceType] = useState('local')
  const [editMinBooking, setEditMinBooking] = useState('0')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileDirty, setProfileDirty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, pkgRes] = await Promise.all([
        fetch(`/api/admin/tariffs/profiles/${id}`),
        fetch(`/api/admin/tariffs/profiles/${id}/packages`),
      ])
      if (!profileRes.ok) { router.push('/admin/settings/tariffs'); return }
      const [p, pkgs] = await Promise.all([profileRes.json(), pkgRes.json()])
      setProfile(p)
      setEditName(p.name)
      setEditServiceType(p.service_type)
      setEditMinBooking(String(p.min_booking_amount ?? 0))
      setPackages(Array.isArray(pkgs) ? pkgs : [])
    } catch {
      toast.error('Failed to load tariff profile')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function saveProfile() {
    if (!editName.trim()) { toast.error('Name is required'); return }
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/admin/tariffs/profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), service_type: editServiceType, min_booking_amount: numVal(editMinBooking) }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to save'); return }
      setProfile(json)
      setProfileDirty(false)
      toast.success('Tariff settings saved.')
    } catch {
      toast.error('Network error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePackage(pkgId: string, update: Partial<TariffPackage>) {
    const res = await fetch(`/api/admin/tariffs/packages/${pkgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Failed to update package'); return }
    setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, ...json } : p))
    toast.success('Package updated.')
  }

  async function deletePackage(pkgId: string) {
    const res = await fetch(`/api/admin/tariffs/packages/${pkgId}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) { toast.error('Failed to delete package'); return }
    setPackages(prev => prev.filter(p => p.id !== pkgId))
    toast.success('Package removed.')
  }

  async function togglePackage(pkgId: string, active: boolean) {
    await savePackage(pkgId, { is_active: active })
  }

  async function addPackage(pkg: Omit<TariffPackage, 'id' | 'profile_id' | 'is_active' | 'sort_order'>) {
    const res = await fetch(`/api/admin/tariffs/profiles/${id}/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pkg),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Failed to add package'); return }
    setPackages(prev => [...prev, json])
    toast.success('Package added.')
  }

  async function toggleProfileActive() {
    if (!profile) return
    const res = await fetch(`/api/admin/tariffs/profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !profile.is_active }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Failed to update'); return }
    setProfile(json)
    toast.success(json.is_active ? 'Tariff activated.' : 'Tariff deactivated.')
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  )

  if (!profile) return null

  const INNER_NAV: { key: Section; label: string }[] = [
    { key: 'setup', label: 'Core / Global Setup' },
    { key: 'rates', label: 'Hourly Moving Rates' },
  ]

  const INNER_SOON = ['Transportation Rates', 'Add-ons / Extra Services', 'Protection', 'Defaults / Automations']

  return (
    <div className="space-y-5">
      {/* Breadcrumb + header */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
          <Link href="/admin/settings/tariffs" className="hover:text-slate-800">Tariff Library</Link>
          <ChevronRight size={12} />
          <span className="text-slate-700">{profile.name}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-950">{profile.name}</h1>
              <button
                type="button"
                onClick={toggleProfileActive}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                  profile.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                )}
              >
                {profile.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {SERVICE_TYPE_LABELS[profile.service_type] ?? profile.service_type} · Local Moving Tariff
            </p>
          </div>
        </div>
      </div>

      {/* 2-column layout: inner nav + content */}
      <div className="flex gap-5">
        {/* Inner left nav */}
        <nav className="w-48 shrink-0 space-y-0.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Core Labor Rates</p>
          {INNER_NAV.map(n => (
            <button
              key={n.key}
              type="button"
              onClick={() => setSection(n.key)}
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                section === n.key
                  ? 'bg-kratos/10 font-semibold text-slate-950'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {n.label}
            </button>
          ))}
          <div className="pt-3">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Coming soon</p>
            {INNER_SOON.map(label => (
              <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed">
                {label}
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-400">Soon</span>
              </div>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {section === 'setup' && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Local Moving</p>
                <h2 className="mt-0.5 text-lg font-semibold text-slate-950">Common</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Tariff Name</label>
                  <input
                    value={editName}
                    onChange={e => { setEditName(e.target.value); setProfileDirty(true) }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Applies To Opportunity Types</label>
                  <select
                    value={editServiceType}
                    onChange={e => { setEditServiceType(e.target.value); setProfileDirty(true) }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos"
                  >
                    {Object.entries(SERVICE_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Minimum Booking Amount</label>
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-kratos focus-within:ring-2 focus-within:ring-kratos/20">
                    <span className="text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editMinBooking}
                      onChange={e => { setEditMinBooking(e.target.value); setProfileDirty(true) }}
                      className="w-full bg-transparent px-2 py-2.5 text-sm text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
              {profileDirty && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
                  >
                    {savingProfile && <Loader2 size={14} className="animate-spin" />}
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          )}

          {section === 'rates' && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Local Moving</p>
                <h2 className="mt-0.5 text-lg font-semibold text-slate-950">Hourly Moving Rates</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Set the hourly rate for each package. Weekday = Mon–Fri · Weekend / Peak = Sat, Sun, holidays.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3 text-left">Package</th>
                      <th className="px-4 py-3 text-left">Trucks</th>
                      <th className="px-4 py-3 text-left">Crew</th>
                      <th className="px-4 py-3 text-left">Weekday Rate</th>
                      <th className="px-4 py-3 text-left">Weekend / Peak</th>
                      <th className="px-4 py-3 text-left">Min Hours</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {packages.map(pkg => (
                      <PackageRow
                        key={pkg.id}
                        pkg={pkg}
                        onSave={savePackage}
                        onDelete={deletePackage}
                        onToggle={togglePackage}
                      />
                    ))}
                    <AddPackageRow onAdd={addPackage} />
                  </tbody>
                </table>
              </div>

              {packages.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  No packages yet. Use &ldquo;+ Add Package&rdquo; above to create Silver, Gold, or a custom package.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
