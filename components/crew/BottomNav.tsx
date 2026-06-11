'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, History, Settings } from 'lucide-react'

const NAV = [
  { href: '/crew/jobs', icon: Briefcase, label: 'My Jobs' },
  { href: '/crew/history', icon: History, label: 'History' },
  { href: '/crew/settings', icon: Settings, label: 'Settings' },
]

const HIDE_ON = ['/crew/login', '/crew/auth']

export function BottomNav() {
  const pathname = usePathname()
  if (HIDE_ON.some(p => pathname.startsWith(p))) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 flex safe-area-inset-bottom">
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-4 text-[10px] font-semibold transition-colors ${
              active ? 'text-[#ffad33]' : 'text-slate-500'
            }`}
          >
            <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
