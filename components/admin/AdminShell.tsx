'use client'

import { useState } from 'react'
import Sidebar from '@/components/admin/Sidebar'
import Header from '@/components/admin/Header'
import ModalManager from '@/components/admin/modals/ModalManager'
import { CreationModalsProvider } from '@/contexts/CreationModalsContext'
import { cn } from '@/lib/utils'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <CreationModalsProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
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
          <Header onMobileMenuToggle={() => setMobileOpen(o => !o)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
      <ModalManager />
    </CreationModalsProvider>
  )
}
