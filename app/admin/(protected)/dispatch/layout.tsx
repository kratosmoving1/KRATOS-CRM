import type { ReactNode } from 'react'
import { Truck } from 'lucide-react'
import { DispatchTabs } from '@/components/admin/dispatch/DispatchTabs'

export default function DispatchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-orange-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dispatch</h1>
            <p className="text-sm text-slate-500">Workforce and crew scheduling</p>
          </div>
        </div>
      </div>
      <DispatchTabs />
      <div className="mt-4">{children}</div>
    </div>
  )
}
