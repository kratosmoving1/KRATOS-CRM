import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildDestinationAddress,
  computeBillableTravelHours,
  fetchReturnDriveMinutes,
} from './travel'

export type TravelSyncResult =
  | { action: 'below_threshold';  return_minutes: number; billable_hours: 0 }
  | { action: 'created' | 'updated'; return_minutes: number; billable_hours: number }
  | { action: 'deleted' }
  | { action: 'no_destination' }
  | { action: 'api_unavailable'; warning: string }

/**
 * Read the current Moving Labor charge and return its hourly_rate.
 * Returns null if no Moving Labor charge is applied.
 */
async function getLaborRate(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('opportunity_charges')
    .select('config')
    .eq('opportunity_id', opportunityId)
    .eq('charge_type', 'moving_labor')
    .neq('is_deleted', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const rate = Number((data.config as Record<string, unknown>)?.hourly_rate ?? 0)
  return rate > 0 ? rate : null
}

/**
 * Sync the trip_and_travel charge for an opportunity based on the
 * return-leg (destination → dispatch) drive time.
 *
 * Rules:
 *   - No destination address → delete any existing charge
 *   - API unavailable → leave existing charge untouched, return warning
 *   - Return drive < 30 min → delete any existing charge
 *   - Return drive ≥ 30 min → create or update charge at the Moving Labor rate
 *
 * @param supabase   Authenticated supabase client (user or admin)
 * @param opportunity Full or partial opportunity row — must include dest_* fields
 * @param laborRate  Hourly rate from the current Moving Labor charge. If null, falls
 *                   back to reading from the DB. Pass null when calling from rerate.
 */
export async function syncTravelCharge(
  supabase: SupabaseClient,
  opportunity: Record<string, unknown>,
  laborRate: number | null = null,
): Promise<TravelSyncResult> {
  const opportunityId = String(opportunity.id)

  // Find existing trip_and_travel charge (if any)
  const { data: existing } = await supabase
    .from('opportunity_charges')
    .select('id, subtotal, total, config')
    .eq('opportunity_id', opportunityId)
    .eq('charge_type', 'trip_and_travel')
    .neq('is_deleted', true)
    .maybeSingle()

  // Destination address
  const destAddress = buildDestinationAddress(opportunity)
  if (!destAddress) {
    if (existing) {
      await supabase
        .from('opportunity_charges')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return { action: 'no_destination' }
  }

  // Resolve labor rate
  const rate = laborRate ?? (await getLaborRate(supabase, opportunityId))
  if (!rate) {
    // No package applied yet — can't compute travel charge without a rate.
    // Don't delete existing; just skip.
    return { action: 'api_unavailable', warning: 'No Moving Labor charge found — apply a package first to enable travel charge.' }
  }

  // Call Distance Matrix
  const returnMinutes = await fetchReturnDriveMinutes(destAddress)
  if (returnMinutes == null) {
    return {
      action: 'api_unavailable',
      warning: 'Travel time unavailable — Distance Matrix call failed. Existing Trip & Travel charge (if any) was preserved.',
    }
  }

  const billableHours = computeBillableTravelHours(returnMinutes)

  // Below threshold — remove any existing charge
  if (billableHours === 0) {
    if (existing) {
      await supabase
        .from('opportunity_charges')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return { action: 'below_threshold', return_minutes: returnMinutes, billable_hours: 0 }
  }

  const subtotal = +(billableHours * rate).toFixed(2)
  const config = {
    source: 'auto_distance_matrix',
    return_drive_minutes: returnMinutes,
    billable_hours: billableHours,
    hourly_rate: rate,
    computed_at: new Date().toISOString(),
  }
  const description = `${billableHours}h @ $${rate.toFixed(2)}/hr (Return: ${returnMinutes} min)`

  if (existing) {
    await supabase
      .from('opportunity_charges')
      .update({
        name: 'Trip & Travel',
        description,
        config,
        subtotal,
        discount_type: null,
        discount_value: null,
        discount_amount: 0,
        total: subtotal,
        is_overridden: false,
        override_reason: null,
      })
      .eq('id', existing.id)
    return { action: 'updated', return_minutes: returnMinutes, billable_hours: billableHours }
  }

  // Find the max sort_order so the new charge lands at the bottom
  const { data: maxRow } = await supabase
    .from('opportunity_charges')
    .select('sort_order')
    .eq('opportunity_id', opportunityId)
    .neq('is_deleted', true)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase
    .from('opportunity_charges')
    .insert({
      opportunity_id: opportunityId,
      charge_type: 'trip_and_travel',
      name: 'Trip & Travel',
      description,
      config,
      subtotal,
      discount_type: null,
      discount_value: null,
      discount_amount: 0,
      total: subtotal,
      is_overridden: false,
      sort_order: (maxRow?.sort_order ?? -1) + 1,
    })
  return { action: 'created', return_minutes: returnMinutes, billable_hours: billableHours }
}
