'use client'

import { Avatar } from './Avatar'
import type { WorkforcePerson } from '@/lib/workforce/types'
import { ENGLISH_LABEL } from './PeopleFilterBar'

interface Props {
  person: WorkforcePerson
  onClick: () => void
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${color}25`, color }}
    >
      {children}
    </span>
  )
}


export function PersonListCard({ person, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-4 text-left hover:shadow-md hover:border-slate-300 transition-all duration-150 flex flex-col gap-3 w-full"
    >
      {/* Avatar + tier badge */}
      <div className="flex items-start justify-between">
        <Avatar src={person.profile_picture_url} name={person.name} size="lg" />
        {person.tier && (
          <span
            className="px-2 py-0.5 rounded-md text-xs font-bold text-white"
            style={{ backgroundColor: person.tier.color }}
          >
            {person.tier.label}
          </span>
        )}
      </div>

      {/* Name + role */}
      <div>
        <h3 className="font-semibold text-slate-900 truncate text-sm">{person.name}</h3>
        {person.role_data && (
          <p className="text-xs text-slate-600 truncate mt-0.5">{person.role_data.label}</p>
        )}
      </div>

      {/* Attribute pills */}
      {(person.location || person.english_proficiency) && (
        <div className="flex flex-wrap gap-1.5">
          {person.location && (
            <Pill color={person.location.color}>{person.location.label}</Pill>
          )}
          {person.english_proficiency && (
            <Pill color="#64748b">{ENGLISH_LABEL[person.english_proficiency] ?? person.english_proficiency}</Pill>
          )}
        </div>
      )}

      {/* Status dot */}
      {person.status && (
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: person.status.color }}
          />
          <span className="text-xs text-slate-600">{person.status.label}</span>
        </div>
      )}
    </button>
  )
}
