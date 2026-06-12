import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildDestinationAddress,
  buildOriginAddress,
  computeBillableTravelHours,
  fetchLongerTravelLegMinutes,
} from './travel'

export type TravelSyncResult =
  | { action: 'below_threshold';  longer_leg_minutes: number; billable_hours: 0 }
  | { action: 'created' | 'updated'; longer_leg_minutes: number; billable_hours: number; leg: string }
  | { action: 'deleted' }
  | { action: 'no_addresses' }
  | { action: 'api_unavailable'; warning: string }

async function getLaborRate(supabase: SupabaseClient, opportunityId: string): Promise<number | null> {
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
 * Sync the trip_and_travel charge using the LONGER of the two travel legs:
 *   Outbound: dispatch → origin
 *   Return:   destination → dispatch
 *
 * This ensures jobs where dest = dispatch (storage drops, yard deliveries) still
 * generate a travel charge for the outbound leg.
 */
export async function syncTravelCharge(
  supabase: SupabaseClient,
  opportunity: Record<string, unknown>,
  laborRate: number | null = null,
): Promise<TravelSyncResult> {
  const opportunityId = String(opportunity.id)

  const { data: existing } = await supabase
    .from('opportunity_charges')
    .select('id, subtotal, total, config')
    .eq('opportunity_id', opportunityId)
    .eq('charge_type', 'trip_and_travel')
    .neq('is_deleted', true)
    .maybeSingle()

  const originAddress = buildOriginAddress(opportunity)
  const destAddress = buildDestinationAddress(opportunity)

  if (!originAddress && !destAddress) {
    if (existing) {
      await supabase
        .from('opportunity_charges')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return { action: 'no_addresses' }
  }

  const rate = laborRate ?? (await getLaborRate(supabase, opportunityId))
  if (!rate) {
    return { action: 'api_unavailable', warning: 'No Moving Labor charge found — apply a package first to enable travel charge.' }
  }

  const { minutes: longerLegMinutes, leg } = await fetchLongerTravelLegMinutes(originAddress, destAddress)

  if (longerLegMinutes == null) {
    return {
      action: 'api_unavailable',
      warning: 'Travel time unavailable — Distance Matrix call failed. Existing Trip & Travel charge (if any) was preserved.',
    }
  }

  const billableHours = computeBillableTravelHours(longerLegMinutes)

  if (billableHours === 0) {
    if (existing) {
      await supabase
        .from('opportunity_charges')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return { action: 'below_threshold', longer_leg_minutes: longerLegMinutes, billable_hours: 0 }
  }

  const subtotal = +(billableHours * rate).toFixed(2)
  const config = {
    source: 'auto_distance_matrix',
    longer_leg_minutes: longerLegMinutes,
    leg,
    billable_hours: billableHours,
    hourly_rate: rate,
    computed_at: new Date().toISOString(),
  }
  const legLabel = leg === 'outbound' ? 'Dispatch→Origin' : 'Destination→Dispatch'
  const description = `${billableHours}h @ $${rate.toFixed(2)}/hr (${legLabel}: ${longerLegMinutes} min)`

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
    return { action: 'updated', longer_leg_minutes: longerLegMinutes, billable_hours: billableHours, leg: leg! }
  }

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
  return { action: 'created', longer_leg_minutes: longerLegMinutes, billable_hours: billableHours, leg: leg! }
}
