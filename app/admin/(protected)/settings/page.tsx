import Link from 'next/link'
import { Tag, PlugZap, FileText } from 'lucide-react'

const ACTIVE_SECTIONS = [
  {
    href: '/admin/settings/tariffs',
    icon: Tag,
    title: 'Tariffs & Packages',
    description: 'Local move packages, hourly rates, move size rules, and return travel logic.',
  },
  {
    href: '/admin/settings/templates',
    icon: FileText,
    title: 'Communication Templates',
    description: 'SMS and email templates for no-answer, follow-ups, and estimate sends.',
  },
  {
    href: '/admin/settings/integrations',
    icon: PlugZap,
    title: 'Integrations',
    description: 'Diagnostics for RingCentral, Resend, Stripe, Supabase, and portal config.',
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">Manage CRM configuration, tariffs, and integrations.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ACTIVE_SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-kratos/60 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-kratos/10 text-kratos">
                <Icon size={20} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
