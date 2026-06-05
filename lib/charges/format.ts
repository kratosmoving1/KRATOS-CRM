import type { OpportunityCharge } from '@/components/admin/charges/types'

/**
 * Returns a human-readable rate/detail string for the RATE column
 * of the unified Charges table. Reads from charge.config.
 */
export function formatRate(charge: OpportunityCharge): string {
  const c = charge.config ?? {}

  switch (charge.charge_type) {
    case 'moving_labor': {
      const hours = Number(c.billable_hours ?? c.total_hours ?? 0)
      const rate = Number(c.hourly_rate ?? 0)
      const trucks = Number(c.num_trucks ?? 0)
      const crew = Number(c.num_crew ?? 0)
      const truckText =
        trucks === 0 ? 'no truck' : `${trucks} truck${trucks > 1 ? 's' : ''}`
      return `${hours}h @ $${rate.toFixed(2)}/hr (${truckText}, ${crew} crew)`
    }

    case 'transportation': {
      if (c.miles && c.rate_per_mile)
        return `${c.miles} mi @ $${Number(c.rate_per_mile).toFixed(2)}/mi`
      return String(charge.description ?? '')
    }

    case 'trip_and_travel': {
      if (c.distance_km && c.rate_per_km)
        return `${c.distance_km} km @ $${Number(c.rate_per_km).toFixed(2)}/km`
      return String(charge.description ?? '')
    }

    case 'fuel_surcharge': {
      if (c.percentage_of_labor != null)
        return `${c.percentage_of_labor}% of moving labor`
      if (c.flat_amount != null)
        return `Flat $${Number(c.flat_amount).toFixed(2)}`
      return String(charge.description ?? '')
    }

    case 'valuation': {
      if (c.coverage_amount && c.premium_rate)
        return `$${c.coverage_amount} coverage @ ${c.premium_rate}%`
      return String(charge.description ?? '')
    }

    case 'storage': {
      const months = Number(c.months ?? 0)
      const rate = Number(c.monthly_rate ?? 0)
      if (months && rate)
        return `${months} month${months !== 1 ? 's' : ''} @ $${rate.toFixed(2)}/mo`
      return String(charge.description ?? '')
    }

    case 'storage_in_transit': {
      const days = Number(c.num_days ?? 0)
      const rate = Number(c.daily_rate ?? 0)
      if (days && rate)
        return `${days} day${days !== 1 ? 's' : ''} @ $${rate.toFixed(2)}/day`
      return String(charge.description ?? '')
    }

    case 'packing':
    case 'materials':
    case 'bulky_item':
    case 'additional_services':
    default: {
      if (c.quantity != null && c.unit_rate != null)
        return `${c.quantity} × $${Number(c.unit_rate).toFixed(2)}`
      return String(charge.description ?? '')
    }
  }
}
