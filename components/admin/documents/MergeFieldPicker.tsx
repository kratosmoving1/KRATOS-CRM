'use client'

import { useState, useMemo } from 'react'
import { Search, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { MERGE_FIELDS, MERGE_FIELD_GROUPS, type MergeFieldGroup } from '@/lib/documents/merge-fields'

interface Props {
  onInsert: (token: string) => void
}

export default function MergeFieldPicker({ onInsert }: Props) {
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<MergeFieldGroup>>(
    () => new Set(MERGE_FIELD_GROUPS),
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return MERGE_FIELDS
    const q = query.toLowerCase()
    return MERGE_FIELDS.filter(
      f =>
        f.label.toLowerCase().includes(q) ||
        f.token.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q),
    )
  }, [query])

  const grouped = useMemo(() => {
    return MERGE_FIELD_GROUPS.map(group => ({
      group,
      fields: filtered.filter(f => f.group === group),
    })).filter(g => g.fields.length > 0)
  }, [filtered])

  function toggleGroup(g: MergeFieldGroup) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-3">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-widest">Merge Fields</p>
        <div className="group relative">
          <HelpCircle size={13} className="text-slate-400 cursor-help" />
          <div className="absolute right-0 top-5 z-10 hidden group-hover:block w-52 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
            Click any field to insert it at your cursor position in the editor.
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative px-3 py-2 border-b border-slate-100">
        <Search size={13} className="absolute left-5.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search fields..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-3 py-1.5 text-xs outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
        />
      </div>

      {/* Field groups */}
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-400">No fields match &ldquo;{query}&rdquo;</p>
        )}
        {grouped.map(({ group, fields }) => {
          const isOpen = openGroups.has(group)
          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{group}</span>
                {isOpen ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
              </button>

              {isOpen && (
                <div className="pb-1">
                  {fields.map(field => (
                    <button
                      key={field.token}
                      type="button"
                      onClick={() => onInsert(field.token)}
                      className="w-full px-3 py-2 text-left hover:bg-amber-50 hover:border-l-2 hover:border-amber-400 transition-colors group"
                    >
                      <p className="font-mono text-[10px] text-amber-700 group-hover:text-amber-800 truncate">
                        {`{{${field.token}}}`}
                      </p>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">{field.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{field.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
