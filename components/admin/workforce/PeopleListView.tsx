'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, List, Kanban, UserPlus } from 'lucide-react'
import { PeopleFilterBar, type FilterState } from './PeopleFilterBar'
import { PersonListCard } from './PersonListCard'
import { AddPersonModal } from './AddPersonModal'
import { EditPersonDrawer } from './EditPersonDrawer'
import type { BoardState, WorkforcePerson } from '@/lib/workforce/types'

interface Props {
  initial: BoardState
}

const EMPTY_FILTERS: FilterState = {
  role_ids: [],
  location_ids: [],
  status_ids: [],
  tier_ids: [],
  english: [],
}

export function PeopleListView({ initial }: Props) {
  const pathname = usePathname()
  const [people, setPeople] = useState<WorkforcePerson[]>(initial.people)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<WorkforcePerson | null>(null)

  const hasActiveFilters = useMemo(
    () => searchQuery.length > 0 || Object.values(filters).some(v => v.length > 0),
    [searchQuery, filters],
  )

  const filtered = useMemo(() => {
    return people.filter(p => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filters.role_ids.length && !filters.role_ids.includes(p.role_id ?? '')) return false
      if (filters.location_ids.length && !filters.location_ids.includes(p.location_id ?? '')) return false
      if (filters.status_ids.length && !filters.status_ids.includes(p.status_id ?? '')) return false
      if (filters.tier_ids.length && !filters.tier_ids.includes(p.tier_id ?? '')) return false
      if (filters.english.length && !filters.english.includes(p.english_proficiency ?? '')) return false
      return true
    })
  }, [people, searchQuery, filters])

  function handlePersonCreated(person: WorkforcePerson) {
    setPeople(prev => [...prev, person])
  }

  function handlePersonUpdated(updated: WorkforcePerson) {
    setPeople(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
    setSelectedPerson(null)
  }

  function handlePersonDeleted(id: string) {
    setPeople(prev => prev.filter(p => p.id !== id))
    setSelectedPerson(null)
  }

  const isListView = !pathname.includes('/board')

  return (
    <div>
      {/* Toolbar: filter bar + view toggle + add */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <PeopleFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            roles={initial.roles}
            locations={initial.locations}
            statuses={initial.statuses}
            tiers={initial.tiers}
            hasActiveFilters={hasActiveFilters}
            onClearAll={() => { setSearchQuery(''); setFilters(EMPTY_FILTERS) }}
          />
        </div>
      </div>

      {/* Action row: count + view toggle + add button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {hasActiveFilters
            ? `Showing ${filtered.length} of ${people.length} people`
            : `${people.length} ${people.length === 1 ? 'person' : 'people'}`
          }
        </p>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
            <Link
              href="/admin/dispatch/workforce"
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                isListView ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List size={13} /> List
            </Link>
            <Link
              href="/admin/dispatch/workforce/board"
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                !isListView ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Kanban size={13} /> Board
            </Link>
          </div>

          {/* Add person */}
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-kratos text-slate-950 rounded-md hover:opacity-90"
          >
            <Plus size={14} /> Add Person
          </button>
        </div>
      </div>

      {/* Empty state: no people at all */}
      {people.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
            <UserPlus className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No crew members yet</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-xs">
            Add your first person to start building your workforce database.
          </p>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="mt-4 flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-kratos text-slate-950 rounded-md hover:opacity-90"
          >
            <Plus size={14} /> Add Your First Person
          </button>
        </div>
      )}

      {/* Empty state: filters return nothing */}
      {people.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-slate-500 text-sm">No people match the current filters.</p>
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setFilters(EMPTY_FILTERS) }}
            className="mt-2 text-sm text-orange-600 hover:text-orange-700 underline"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Person grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(person => (
            <PersonListCard
              key={person.id}
              person={person}
              onClick={() => setSelectedPerson(person)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {addModalOpen && (
        <AddPersonModal
          roles={initial.roles}
          locations={initial.locations}
          statuses={initial.statuses}
          tiers={initial.tiers}
          onCreated={handlePersonCreated}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {selectedPerson && (
        <EditPersonDrawer
          person={selectedPerson}
          roles={initial.roles}
          locations={initial.locations}
          statuses={initial.statuses}
          tiers={initial.tiers}
          onUpdated={handlePersonUpdated}
          onDeleted={handlePersonDeleted}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </div>
  )
}
