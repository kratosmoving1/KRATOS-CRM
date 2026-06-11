'use client'

import { useRef, useEffect, useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import type { WorkforceRole, WorkforceLocation, WorkforceStatus, WorkforceTier } from '@/lib/workforce/types'

export const ENGLISH_LEVELS = [
  { id: 'no_english', label: 'No English' },
  { id: 'medium',     label: 'Medium Proficiency' },
  { id: 'high',       label: 'High Proficiency' },
]

export const ENGLISH_LABEL: Record<string, string> = Object.fromEntries(
  ENGLISH_LEVELS.map(l => [l.id, l.label])
)

export interface FilterState {
  role_ids: string[]
  location_ids: string[]
  status_ids: string[]
  tier_ids: string[]
  english: string[]
}

interface MultiOption { id: string; label: string; color?: string }

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: MultiOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const count = selected.length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
          count > 0
            ? 'border-orange-400 bg-orange-50 text-orange-700'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
        }`}
      >
        {label}
        {count > 0 && (
          <span className="ml-0.5 rounded-full bg-orange-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
            {count}
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 min-w-[160px]">
          {options.map(opt => (
            <label
              key={opt.id}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggle(opt.id)}
                className="accent-orange-500 w-3.5 h-3.5"
              />
              {opt.color && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
              )}
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  searchQuery: string
  onSearchChange: (q: string) => void
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  roles: WorkforceRole[]
  locations: WorkforceLocation[]
  statuses: WorkforceStatus[]
  tiers: WorkforceTier[]
  hasActiveFilters: boolean
  onClearAll: () => void
}

export function PeopleFilterBar({
  searchQuery, onSearchChange,
  filters, onFiltersChange,
  roles, locations, statuses, tiers,
  hasActiveFilters, onClearAll,
}: Props) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        <MultiSelectFilter
          label="Role"
          options={roles}
          selected={filters.role_ids}
          onChange={ids => onFiltersChange({ ...filters, role_ids: ids })}
        />
        <MultiSelectFilter
          label="Location"
          options={locations}
          selected={filters.location_ids}
          onChange={ids => onFiltersChange({ ...filters, location_ids: ids })}
        />
        <MultiSelectFilter
          label="Status"
          options={statuses}
          selected={filters.status_ids}
          onChange={ids => onFiltersChange({ ...filters, status_ids: ids })}
        />
        <MultiSelectFilter
          label="Tier"
          options={tiers}
          selected={filters.tier_ids}
          onChange={ids => onFiltersChange({ ...filters, tier_ids: ids })}
        />
        <MultiSelectFilter
          label="English"
          options={ENGLISH_LEVELS}
          selected={filters.english}
          onChange={eng => onFiltersChange({ ...filters, english: eng })}
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}
