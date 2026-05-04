import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  sublabel: string
  icon: LucideIcon
  className?: string
}

export default function StatCard({ label, value, sublabel, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
        </div>
        <div className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-kratos/10">
          <Icon size={20} className="text-kratos" />
        </div>
      </div>
    </div>
  )
}
