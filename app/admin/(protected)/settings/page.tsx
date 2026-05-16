import Link from 'next/link'
import { PlugZap } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">Manage CRM configuration and admin tools.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/admin/settings/integrations"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-kratos/60 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-kratos/10 text-kratos">
              <PlugZap size={20} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Integrations</h2>
              <p className="mt-1 text-sm text-slate-500">Diagnostics for RingCentral, Resend, Stripe, Supabase, and portal config.</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
