'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Plus, Pencil, Truck, CheckCircle, AlertCircle, WrenchIcon, X } from 'lucide-react'

interface DispatchTruck {
  id: string
  name: string
  category: 'owned' | 'rental' | 'contractor'
  provider: string | null
  size: string
  license_plate: string | null
  liftgate: boolean
  ramp: boolean
  status: string
  notes: string | null
}

const CATEGORIES = [
  { key: 'owned', label: 'Owned' },
  { key: 'rental', label: 'Rental' },
  { key: 'contractor', label: 'Contractor' },
] as const

const SIZES = [
  { key: 'cargo_van', label: 'Cargo Van' },
  { key: '10ft', label: '10 ft' },
  { key: '15ft', label: '15 ft' },
  { key: '16ft', label: '16 ft' },
  { key: '20ft', label: '20 ft' },
  { key: '26ft', label: '26 ft' },
]

const PROVIDERS = ['Penske', 'Ryder', 'U-Haul', 'Home Depot', 'Other']

const STATUS_LABELS: Record<string, { label: string; icon: React.ElementType; class: string }> = {
  active:      { label: 'Active',      icon: CheckCircle,  class: 'text-green-700 bg-green-100' },
  inactive:    { label: 'Inactive',    icon: AlertCircle,  class: 'text-slate-600 bg-slate-100' },
  maintenance: { label: 'Maintenance', icon: WrenchIcon,   class: 'text-amber-700 bg-amber-100' },
}

const emptyForm = { name: '', category: 'owned' as 'owned' | 'rental' | 'contractor', provider: '', size: '16ft', license_plate: '', liftgate: false, ramp: false, status: 'active', notes: '' }

export default function DispatchSettingsPage() {
  const [trucks, setTrucks] = useState<DispatchTruck[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/dispatch/trucks?all=true')
    if (res.ok) setTrucks(await res.json() as DispatchTruck[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function startAdd() {
    setEditId(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function startEdit(t: DispatchTruck) {
    setEditId(t.id)
    setForm({
      name: t.name,
      category: t.category,
      provider: t.provider ?? '',
      size: t.size,
      license_plate: t.license_plate ?? '',
      liftgate: t.liftgate,
      ramp: t.ramp,
      status: t.status,
      notes: t.notes ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    const body = {
      name: form.name.trim(),
      category: form.category,
      size: form.size,
      provider: form.category === 'rental' ? (form.provider || null) : null,
      license_plate: form.license_plate || null,
      liftgate: form.liftgate,
      ramp: form.ramp,
      status: form.status,
      notes: form.notes || null,
    }
    const url = editId ? `/api/admin/dispatch/trucks/${editId}` : '/api/admin/dispatch/trucks'
    const method = editId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) {
      cancelForm()
      await load()
    } else {
      const j = await res.json() as { error?: string }
      setError(j.error ?? 'Save failed')
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/dispatch/trucks/${id}`, { method: 'DELETE' })
    await load()
  }

  async function toggleStatus(truck: DispatchTruck) {
    const next = truck.status === 'active' ? 'inactive' : 'active'
    await fetch(`/api/admin/dispatch/trucks/${truck.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    await load()
  }

  const active   = trucks.filter(t => t.status === 'active')
  const inactive = trucks.filter(t => t.status !== 'active')

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Dispatch Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your fleet. Trucks listed here appear in the Dispatch calendar.</p>
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={14} /> Add truck
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-xl border border-kratos/30 bg-kratos/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">{editId ? 'Edit truck' : 'Add new truck'}</h2>
            <button onClick={cancelForm} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kratos 16ft Box, Penske 26ft #1"
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ownership</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as typeof f.category }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-kratos"
              >
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Size</label>
              <select
                value={form.size}
                onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-kratos"
              >
                {SIZES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            {form.category === 'rental' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-kratos"
                >
                  <option value="">— Select provider —</option>
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">License plate</label>
              <input
                value={form.license_plate}
                onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))}
                placeholder="e.g. ABCD 123"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-kratos"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.liftgate} onChange={e => setForm(f => ({ ...f, liftgate: e.target.checked }))} className="rounded" />
                Liftgate
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.ramp} onChange={e => setForm(f => ({ ...f, ramp: e.target.checked }))} className="rounded" />
                Ramp
              </label>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes (internal)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kratos resize-none"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {editId ? 'Save changes' : 'Add truck'}
            </button>
            <button onClick={cancelForm} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
          <Loader2 size={16} className="animate-spin" /> Loading trucks…
        </div>
      ) : trucks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
          <Truck size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No trucks configured yet</p>
          <p className="text-xs text-slate-400 mt-1">Add your first truck above to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <TruckGroup title="Active trucks" trucks={active} onEdit={startEdit} onDelete={handleDelete} onToggleStatus={toggleStatus} />
          )}
          {inactive.length > 0 && (
            <TruckGroup title="Inactive / Maintenance" trucks={inactive} onEdit={startEdit} onDelete={handleDelete} onToggleStatus={toggleStatus} />
          )}
        </div>
      )}
    </div>
  )
}

function TruckGroup({
  title, trucks, onEdit, onDelete, onToggleStatus,
}: {
  title: string
  trucks: DispatchTruck[]
  onEdit: (t: DispatchTruck) => void
  onDelete: (id: string) => void
  onToggleStatus: (t: DispatchTruck) => void
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
        {trucks.map(truck => {
          const statusCfg = STATUS_LABELS[truck.status] ?? STATUS_LABELS.inactive
          const StatusIcon = statusCfg.icon
          return (
            <div key={truck.id} className="flex items-center gap-3 px-4 py-3">
              <Truck size={16} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{truck.name}</span>
                  <span className="text-xs text-slate-500">{truck.size.replace('_', ' ')}</span>
                  {truck.provider && <span className="text-xs text-slate-400">· {truck.provider}</span>}
                  {truck.license_plate && <span className="text-xs text-slate-400">· {truck.license_plate}</span>}
                  {truck.liftgate && <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-medium">Liftgate</span>}
                  {truck.ramp && <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-medium">Ramp</span>}
                </div>
                {truck.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{truck.notes}</p>}
              </div>
              <button
                onClick={() => onToggleStatus(truck)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCfg.class}`}
                title={truck.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
              >
                <StatusIcon size={10} />
                {statusCfg.label}
              </button>
              <button
                onClick={() => onEdit(truck)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${truck.name}"? This cannot be undone.`)) onDelete(truck.id)
                }}
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Delete"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
