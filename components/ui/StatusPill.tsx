import { cn } from '@/lib/utils'
import { OPP_STATUSES } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'

const colorMap: Record<string, string> = {
  green:  'bg-green-100 text-green-700',
  orange: 'bg-kratos/15 text-kratos-700 text-[#b86e00]',
  blue:   'bg-blue-100 text-blue-700',
  slate:  'bg-slate-100 text-slate-500',
  red:    'bg-red-100 text-red-700',
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
