'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Phone,
  Bell,
  Receipt,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin',           label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/admin/opportunities', label: 'Opportunities', icon: Briefcase },
  { href: '/admin/customers',     label: 'Customers',     icon: Users },
  { href: '/admin/estimates',     label: 'Estimates',     icon: FileText },
  { href: '/admin/calls',         label: 'Calls',         icon: Phone },
  { href: '/admin/follow-ups',    label: 'Follow-ups',    icon: Bell },
  { href: '/admin/invoices',      label: 'Invoices',      icon: Receipt },
  { href: '/admin/reports',       label: 'Reports',       icon: BarChart2 },
  { href: '/admin/settings',      label: 'Settings',      icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-[#0b1220] text-white shadow-2xl shadow-slate-950/10 transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-white/10 px-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Image
            src="/logo.png"
            alt="Kratos"
            width={32}
            height={32}
            className="shrink-0 object-contain drop-shadow-sm"
          />
          {!collapsed && (
            <span className="whitespace-nowrap text-sm font-semibold tracking-tight">
              <span className="text-kratos">Kratos</span>
              <span className="text-white"> CRM</span>
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-kratos/15 text-kratos shadow-[inset_0_0_0_1px_rgba(255,168,31,0.08)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white',
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon
                    size={18}
                    className={cn(
                      'shrink-0 transition-colors',
                      active ? 'text-kratos' : 'text-slate-500 group-hover:text-white',
                    )}
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {active && !collapsed && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-kratos" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#0b1220] text-slate-400 shadow-sm transition-colors hover:text-white"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
