'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/admin/Sidebar'
import Header from '@/components/admin/Header'
import ModalManager from '@/components/admin/modals/ModalManager'
import { CreationModalsProvider } from '@/contexts/CreationModalsContext'
import { cn } from '@/lib/utils'
import WelcomeLoading from './WelcomeLoading'

type CurrentUser = {
  id: string
  email: string | null
  full_name: string | null
  role: string
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled) setCurrentUser(data)
      })
      .catch(() => {
        if (!cancelled) setCurrentUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingUser(false)
      })

    return () => { cancelled = true }
  }, [])

  if (loadingUser) {
    return <WelcomeLoading name={currentUser?.full_name ?? currentUser?.email} fullScreen />
  }

  return (
    <CreationModalsProvider>
      <div className="flex h-screen overflow-hidden bg-[#f6f7fb]">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <div
          className={cn(
            'fixed inset-y-0 left-0 z-30 md:relative md:flex md:z-auto',
            mobileOpen ? 'flex' : 'hidden md:flex',
          )}
        >
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(c => !c)}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header
            onMobileMenuToggle={() => setMobileOpen(o => !o)}
            currentUser={currentUser}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-7">
            {children}
          </main>
        </div>
      </div>
      <ModalManager />
    </CreationModalsProvider>
  )
}
