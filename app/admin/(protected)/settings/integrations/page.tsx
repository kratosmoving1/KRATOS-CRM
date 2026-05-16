import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/permissions'
import IntegrationDiagnosticsClient from '@/components/admin/integrations/IntegrationDiagnosticsClient'

export default async function IntegrationsDiagnosticsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return (
      <AccessDenied message="You must be signed in to view integration diagnostics." />
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (!profile?.is_active || !['owner', 'admin', 'manager'].includes(role)) {
    return <AccessDenied message="Only owner/admin users can access integration diagnostics. Managers may view when enabled." />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Settings</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Integrations Diagnostics</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Verify production configuration for RingCentral, Resend, Stripe, Supabase, and the customer portal.
          </p>
        </div>
        <Link href="/admin/settings" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Settings
        </Link>
      </div>

      <IntegrationDiagnosticsClient />
    </div>
  )
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <ShieldAlert className="mx-auto text-red-600" size={28} />
        <h1 className="mt-3 text-lg font-semibold text-red-950">Access denied</h1>
        <p className="mt-2 text-sm text-red-700">{message}</p>
      </div>
    </div>
  )
}
