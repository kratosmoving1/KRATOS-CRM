import { createAdminClient } from '@/lib/supabase/admin'
import { calculateEstimate } from '@/lib/charges/calculate'
import { MOVE_SIZE_LABELS } from '@/lib/constants'
import EstimatePortalContent, { type PortalCharge, type PortalPageData, type PortalSettings, type ContentBlock } from '@/components/portal/EstimatePortalContent'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  params: { token: string }
  searchParams: { preview?: string; payment?: string }
}

type CustomerField =
  | { full_name: string; email: string | null; phone: string | null }[]
  | { full_name: string; email: string | null; phone: string | null }
  | null

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
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

export default async function EstimatePortalPage({ params, searchParams }: PageProps) {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return <PortalError title="Estimate portal unavailable" />
  }

  const { data: link } = await supabase
    .from('estimate_portal_links')
    .select('id, opportunity_id, quote_id, expires_at')
    .eq('token', params.token)
    .maybeSingle()

  if (!link || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return <PortalError title="Estimate link unavailable" />
  }

  // Record view
  await supabase
    .from('estimate_portal_links')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', link.id)

  const { data: opp } = await supabase
    .from('opportunities')
    .select('*, customer:customers!customer_id(full_name, email, phone)')
    .eq('id', link.opportunity_id)
    .not('is_deleted', 'is', 'true')
    .single()

  if (!opp) return <PortalError title="Estimate not found" />

  // Fetch charges WITH config so we can read labor rate breakdown
  const { data: rawCharges } = await supabase
    .from('opportunity_charges')
    .select('name, charge_type, subtotal, discount_amount, total, config')
    .eq('opportunity_id', link.opportunity_id)
    .eq('is_deleted', false)
    .order('sort_order')
    .order('created_at')

  const charges: PortalCharge[] = (rawCharges ?? []).map(c => ({
    name: String(c.name ?? ''),
    charge_type: String(c.charge_type ?? ''),
    subtotal: Number(c.subtotal ?? 0),
    discount_amount: Number(c.discount_amount ?? 0),
    total: Number(c.total ?? 0),
    config: (c.config as Record<string, unknown>) ?? {},
  }))

  const totals = calculateEstimate(charges, 0.13, false)
  const customer = one(opp.customer as CustomerField)
  const savedDeposit = Number(opp.deposit_amount ?? 150)
  const deposit = Number.isFinite(savedDeposit) && savedDeposit > 0 ? savedDeposit : 150
  const moveSize = opp.move_size
    ? (MOVE_SIZE_LABELS[opp.move_size] ?? String(opp.move_size).replace(/_/g, ' '))
    : 'To be confirmed'

  // Fetch portal settings, signatures, content blocks, payment status, and historical spend in parallel
  const [signatureResult, settingsResult, blocksResult, paymentResult, historicalSpendResult] = await Promise.all([
    supabase
      .from('estimate_signatures')
      .select('id')
      .eq('opportunity_id', link.opportunity_id)
      .maybeSingle(),
    supabase
      .from('customer_portal_settings')
      .select(`
        *,
        attachments:customer_portal_attachments(id, name, file_url, position, is_deleted),
        badges:customer_portal_badges(id, name, image_url, position, is_deleted)
      `)
      .maybeSingle(),
    supabase
      .from('customer_portal_content_blocks')
      .select('id, section_type, title, body, data, position, is_visible')
      .eq('is_deleted', false)
      .eq('is_visible', true)
      .order('position', { ascending: true }),
    supabase
      .from('payments')
      .select('id')
      .eq('opportunity_id', link.opportunity_id)
      .eq('status', 'received')
      .limit(1)
      .maybeSingle(),
    opp.customer_id
      ? supabase
          .from('payments')
          .select('amount_cents')
          .eq('customer_id', opp.customer_id)
          .not('is_deleted', 'is', true)
          .eq('status', 'received')
      : Promise.resolve({ data: null, error: null }),
  ])

  const signature   = signatureResult.data
  const depositPaid = Boolean(paymentResult.data)

  const customerTotalSpent = (historicalSpendResult.data ?? []).reduce(
    (sum, r) => sum + (Number(r.amount_cents) || 0) / 100,
    0,
  )
  const totalPoints  = Math.floor(customerTotalSpent * 0.5)
  const earnedPoints = Math.floor(totals.subtotal * 0.5)

  const data: PortalPageData = {
    opp: {
      id: opp.id,
      opportunity_number: opp.opportunity_number,
      status: opp.status,
      service_type: opp.service_type,
      service_date: opp.service_date ?? null,
      arrival_window_start: opp.arrival_window_start ?? null,
      arrival_window_end: opp.arrival_window_end ?? null,
      move_size: opp.move_size ?? null,
      deposit_amount: opp.deposit_amount ?? null,
      origin_address_line1: opp.origin_address_line1 ?? null,
      origin_city: opp.origin_city ?? null,
      origin_province: opp.origin_province ?? null,
      dest_address_line1: opp.dest_address_line1 ?? null,
      dest_city: opp.dest_city ?? null,
      dest_province: opp.dest_province ?? null,
    },
    customer: customer ?? null,
    charges,
    subtotal: totals.subtotal,
    discounts: totals.total_discounts,
    hst: totals.sales_tax,
    total: totals.estimate_total,
    deposit,
    moveSize,
  }

  type AttachRow       = { id: string; name: string; file_url: string; position: number; is_deleted: boolean }
  type BadgeRow        = { id: string; name: string; image_url: string | null; position: number; is_deleted: boolean }
  type ContentBlockRow = { id: string; section_type: string; title: string | null; body: string | null; data: Record<string, unknown>; position: number; is_visible: boolean }

  let portalSettings: PortalSettings | null = null
  if (settingsResult.data) {
    const raw = settingsResult.data
    portalSettings = {
      company_name:                 String(raw.company_name ?? 'Kratos Moving Inc.'),
      company_phone:                String(raw.company_phone ?? '(800) 321-3222'),
      logo_url:                     raw.logo_url as string | null,
      header_notes:                 raw.header_notes as string | null,
      footer_notes:                 raw.footer_notes as string | null,
      show_inventory_button:        Boolean(raw.show_inventory_button ?? true),
      show_download_button:         Boolean(raw.show_download_button ?? true),
      show_materials_section:       Boolean(raw.show_materials_section ?? true),
      show_protection_section:      Boolean(raw.show_protection_section ?? true),
      require_deposit:              Boolean(raw.require_deposit ?? true),
      allow_accept_without_deposit: Boolean(raw.allow_accept_without_deposit ?? false),
      attachments: ((raw.attachments as unknown as AttachRow[]) ?? [])
        .filter(a => !a.is_deleted)
        .sort((a, b) => a.position - b.position)
        .map(({ id, name, file_url }) => ({ id, name, file_url })),
      badges: ((raw.badges as unknown as BadgeRow[]) ?? [])
        .filter(b => !b.is_deleted)
        .sort((a, b) => a.position - b.position)
        .map(({ id, name, image_url }) => ({ id, name, image_url })),
      content_blocks: ((blocksResult.data ?? []) as ContentBlockRow[])
        .map(({ id, section_type, title, body, data: bdata, position, is_visible }) =>
          ({ id, section_type: section_type as ContentBlock['section_type'], title, body, data: (bdata ?? {}) as Record<string, unknown>, position, is_visible })
        ),
    }
  }

  return (
    <EstimatePortalContent
      data={data}
      token={params.token}
      isPreview={Boolean(searchParams.preview)}
      alreadySigned={Boolean(signature)}
      paymentSucceeded={searchParams.payment === 'success'}
      depositPaid={depositPaid}
      portalSettings={portalSettings}
      earnedPoints={earnedPoints}
      totalPoints={totalPoints}
    />
  )
}
