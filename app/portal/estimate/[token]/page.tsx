import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency } from '@/lib/format'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import { MOVE_SIZE_LABELS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { token: string }
  searchParams: { preview?: string }
}

type CustomerField = { full_name: string; email: string | null; phone: string | null }[] | { full_name: string; email: string | null; phone: string | null } | null

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'To be confirmed'
  return new Date(value).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
}

function address(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(', ') || 'To be confirmed'
}

export default async function EstimatePortalPage({ params, searchParams }: PageProps) {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('Estimate portal configuration error:', err)
    return <PortalError title="Estimate portal unavailable" />
  }
  const { data: link } = await supabase
    .from('estimate_portal_links')
    .select('id, opportunity_id, quote_id, expires_at')
    .eq('token', params.token)
    .maybeSingle()

  if (!link || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return (
      <PortalError title="Estimate link unavailable" />
    )
  }

  await supabase
    .from('estimate_portal_links')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', link.id)

  const { data: opp } = await supabase
    .from('opportunities')
    .select('*, customer:customers!customer_id(full_name, email, phone)')
    .eq('id', link.opportunity_id)
    .eq('is_deleted', false)
    .single()

  if (!opp) {
    return (
      <PortalError title="Estimate not found" />
    )
  }

  const customer = one(opp.customer as CustomerField)
  const subtotal = Number(opp.total_amount ?? 0)
  const hst = 0
  const total = subtotal + hst
  const savedDeposit = Number(opp.deposit_amount ?? 150)
  const deposit = Number.isFinite(savedDeposit) && savedDeposit > 0 ? savedDeposit : 150
  const moveSize = opp.move_size ? (MOVE_SIZE_LABELS[opp.move_size] ?? String(opp.move_size).replace(/_/g, ' ')) : 'To be confirmed'

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Kratos Moving" width={42} height={42} className="object-contain" />
            <div>
              <p className="text-sm font-semibold text-kratos">Kratos Moving</p>
              <p className="text-xs text-slate-300">Call anytime: (800) 321-3222</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/80">Manage Inventory</button>
            <Link href={`/portal/estimate/${params.token}/sign`} className="rounded-lg bg-kratos px-3 py-2 text-sm font-semibold text-slate-950">Sign Estimate</Link>
          </div>
        </div>
      </header>

      {searchParams.preview && (
        <div className="bg-amber-50 px-5 py-2 text-center text-xs font-semibold uppercase tracking-widest text-amber-800">
          Admin preview
        </div>
      )}

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-kratos">Your Moving Estimate</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Estimate {formatQuoteNumber(opp.opportunity_number)}</h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Status: Not Booked</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Move date: {dateLabel(opp.service_date)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold capitalize text-slate-700">{moveSize}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Estimated Total</p>
            <p className="mt-2 text-3xl font-semibold text-kratos">{formatCurrency(total)}</p>
            <p className="mt-4 text-sm text-slate-300">Deposit to secure move: {formatCurrency(deposit)}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <InfoCard title="Customer Support" body="Kratos Moving Inc." detail="(800) 321-3222" />
          <InfoCard title="Customer Info" body={customer?.full_name ?? 'Customer'} detail={customer?.email ?? customer?.phone ?? ''} />
          <InfoCard title="Origin" body={address([opp.origin_address_line1, opp.origin_city, opp.origin_province])} detail={opp.origin_postal_code ?? ''} />
          <InfoCard title="Destination" body={address([opp.dest_address_line1, opp.dest_city, opp.dest_province])} detail={opp.dest_postal_code ?? ''} />
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Estimate Details</h2>
          <div className="mt-5 divide-y divide-slate-100 text-sm">
            <DetailRow label="Service" value={String(opp.service_type ?? 'Moving').replace(/_/g, ' ')} />
            <DetailRow label="Move size" value={moveSize} />
            <DetailRow label="Subtotal" value={formatCurrency(subtotal)} />
            <DetailRow label="HST" value={hst > 0 ? formatCurrency(hst) : 'Included / not yet itemized'} />
            <DetailRow label="Total" value={formatCurrency(total)} strong />
            <DetailRow label="Deposit" value={formatCurrency(deposit)} strong />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Attachments & Resources</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              'Kratos Group of Companies - List of Services',
              'Special Thank You From The Kratos Team',
              'Kratos Moving: Customs Clearance for International Moves',
              'How To Pack Your Home, The Kratos Way',
              'Kratos Moving: Our History and Company',
              'Customs Compliance: Avoid These Items When Moving Abroad',
            ].map(item => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <button className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">Manage Inventory</button>
          <Link href={`/portal/estimate/${params.token}/sign`} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Sign Estimate</Link>
          <button className="rounded-xl bg-kratos px-5 py-3 text-sm font-semibold text-slate-950">Pay Deposit</button>
        </div>
      </section>
    </main>
  )
}

function PortalError({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">Please contact Kratos Moving at (800) 321-3222.</p>
      </div>
    </main>
  )
}

function InfoCard({ title, body, detail }: { title: string; body: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{body}</p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </div>
  )
}

function DetailRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? 'font-bold text-slate-950' : 'font-semibold text-slate-700'}>{value}</span>
    </div>
  )
}
