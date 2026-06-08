'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/dispatch/workforce', label: 'Workforce' },
  { href: '/admin/dispatch/calendar', label: 'Calendar' },
]

export function DispatchTabs() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1 border-b border-slate-200">
      {TABS.map(tab => {
        const isActive = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-kratos text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
