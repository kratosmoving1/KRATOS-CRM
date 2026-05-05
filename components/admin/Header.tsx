'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Search, LogOut, Menu, Plus, Briefcase, Target, ListChecks, BellRing } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCreateModal } from '@/contexts/CreationModalsContext'

interface HeaderProps {
  onMobileMenuToggle?: () => void
}

const CREATE_OPTIONS = [
  { label: 'New Opportunity', icon: Briefcase, modal: 'opportunity' as const },
  { label: 'New Lead',        icon: Target,    modal: 'lead'        as const },
  { label: 'New Task',        icon: ListChecks, modal: 'task'       as const },
  { label: 'New Follow-up',   icon: BellRing,  modal: 'followup'   as const },
]

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const router = useRouter()
  const { openModal } = useCreateModal()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      {/* Mobile hamburger */}
      <button
        className="mr-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
        onClick={onMobileMenuToggle}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
        />
      </div>

      {/* Right actions */}
      <div className="ml-4 flex items-center gap-2">
        {/* + Create button */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-kratos px-3 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
            aria-label="Create new"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Create</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <div className="grid grid-cols-2 gap-1.5">
                {CREATE_OPTIONS.map(({ label, icon: Icon, modal }) => (
                  <button
                    key={modal}
                    onClick={() => { setDropdownOpen(false); openModal(modal) }}
                    className="flex flex-col items-center gap-1.5 rounded-lg p-3 text-center text-xs font-medium text-slate-700 transition-colors hover:bg-kratos/10 hover:text-slate-900"
                  >
                    <Icon size={20} className="text-kratos" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-kratos" />
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kratos text-xs font-semibold text-slate-900 select-none">
          KM
        </div>

        <button
          onClick={handleSignOut}
          className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Sign out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  )
}
