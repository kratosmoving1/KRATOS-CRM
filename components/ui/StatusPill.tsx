import { cn } from '@/lib/utils'
import { OPP_STATUSES } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'

const colorMap: Record<string, string> = {
  blue:    'bg-blue-100 text-blue-700',
  cyan:    'bg-cyan-100 text-cyan-700',
  purple:  'bg-purple-100 text-purple-700',
  amber:   'bg-amber-100 text-amber-700',
  green:   'bg-green-100 text-green-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  slate:   'bg-slate-100 text-slate-600',
  red:     'bg-red-100 text-red-700',
}

interface Props {
  status: OppStatus | string
  className?: string
}

export default function StatusPill({ status, className }: Props) {
  const meta = OPP_STATUSES.find(s => s.value === status)
  const label = meta?.label ?? status
  const color = meta ? colorMap[meta.color] : 'bg-slate-100 text-slate-600'

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', color, className)}>
      {label}
    </span>
  )
}
