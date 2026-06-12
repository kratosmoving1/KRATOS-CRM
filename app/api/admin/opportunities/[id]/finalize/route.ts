import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user } = auth.context

  const body = await req.json().catch(() => ({}))

  const {
    actual_labor_hours,
    actual_travel_hours,
    actual_deduction_hours,
    actual_minimum_hours,
    actual_billable_hours,
    actual_crew_count,
    actual_trucks_count,
    include_travel_in_billable,
    invoiced_volume_cuft,
    invoiced_weight_lbs,
    actual_tips_cents,
  } = body as Record<string, unknown>

  const { error } = await supabase
    .from('opportunities')
    .update({
      finalized_at: new Date().toISOString(),
      actual_labor_hours:       actual_labor_hours       ?? null,
      actual_travel_hours:      actual_travel_hours      ?? null,
      actual_deduction_hours:   actual_deduction_hours   ?? null,
      actual_minimum_hours:     actual_minimum_hours     ?? null,
      actual_billable_hours:    actual_billable_hours    ?? null,
      actual_crew_count:        actual_crew_count        ?? null,
      actual_trucks_count:      actual_trucks_count      ?? null,
      include_travel_in_billable: include_travel_in_billable ?? false,
      invoiced_volume_cuft:     invoiced_volume_cuft     ?? null,
      invoiced_weight_lbs:      invoiced_weight_lbs      ?? null,
      actual_tips_cents:        actual_tips_cents        ?? null,
    })
    .eq('id', params.id)
    .neq('is_deleted', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'finalized',
    entityType: 'opportunity',
    entityId: params.id,
    newData: { actual_billable_hours: (actual_billable_hours as number | null) ?? null },
  })

  return NextResponse.json({ ok: true })
}
