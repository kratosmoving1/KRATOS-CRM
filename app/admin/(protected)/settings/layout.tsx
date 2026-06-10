'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Tag, PlugZap, FileText, Building2, CalendarCog, BadgeDollarSign,
  Users2, Megaphone, ClipboardList, Truck, ShieldAlert, BoxSelect,
  Warehouse, PieChart, Cog, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  soon?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Pricing',
    items: [
      { label: 'Tariffs',       href: '/admin/settings/tariffs',      icon: Tag },
    ],
  },
  {
    label: 'Comms & Docs',
    items: [
      { label: 'Templates',        href: '/admin/settings/templates',  icon: FileText },
      { label: 'Documents',        href: '/admin/settings/documents',  icon: BookOpen },
      { label: 'Integrations',     href: '/admin/settings/integrations', icon: PlugZap },
      { label: 'Customer Portal',  href: '/admin/settings/portal',     icon: Users2 },
      { label: 'Dispatch',         href: '/admin/settings/dispatch',   icon: Truck },
    ],
  },
  {
    label: 'Coming soon',
    items: [
      { label: 'Company',          icon: Building2,      soon: true },
      { label: 'Estimates',        icon: CalendarCog,    soon: true },
      { label: 'Sales',            icon: BadgeDollarSign, soon: true },
      { label: 'Marketing',        icon: Megaphone,      soon: true },
      { label: 'Forms & Docs',     icon: ClipboardList,  soon: true },
      { label: 'Claims',           icon: ShieldAlert,    soon: true },
      { label: 'Crew App',         icon: BoxSelect,      soon: true },
      { label: 'Storage',          icon: Warehouse,      soon: true },
      { label: 'Accounting',       icon: PieChart,       soon: true },
      { label: 'Workflow',         icon: Cog,            soon: true },
    ],
  },
]

function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="w-52 shrink-0 border-r border-slate-200 bg-white">
      <div className="px-4 py-4 border-b border-slate-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settings</p>
      </div>
      <div className="py-2">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="mb-3">
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {group.label}
            </p>
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = item.href ? (
                item.href === '/admin/settings'
                  ? pathname === '/admin/settings'
                  : pathname.startsWith(item.href)
              ) : false

              if (item.soon) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-400 cursor-not-allowed"
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="text-sm">{item.label}</span>
                    <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                      Soon
                    </span>
                  </div>
                )
              }

              return (
                <Link
                  key={item.label}
                  href={item.href!}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-kratos/10 font-semibold text-slate-950'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <Icon
                    size={14}
                    className={cn('shrink-0', isActive ? 'text-kratos' : 'text-slate-400')}
                  />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 gap-0 -mx-6 -mt-6">
      <SettingsNav />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
