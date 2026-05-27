import type { ChargeType } from '@/lib/charges/calculate'

export interface OpportunityCharge {
  id: string
  opportunity_id: string
  charge_type: ChargeType
  name: string
  description: string | null
  config: Record<string, unknown>
  subtotal: number
  discount_type: 'percent' | 'amount' | null
  discount_value: number | null
  discount_amount: number
  total: number
  is_overridden: boolean
  override_reason: string | null
  sort_order: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  is_deleted: boolean
  deleted_at: string | null
}

export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  moving_labor:         'Moving Labor',
  transportation:       'Transportation',
  packing:              'Packing',
  materials:            'Materials',
  additional_services:  'Additional Services',
  trip_and_travel:      'Trip and Travel',
  fuel_surcharge:       'Fuel Surcharge',
  valuation:            'Valuation',
  bulky_item:           'Bulky Item',
  storage:              'Storage',
  storage_in_transit:   'Storage in Transit',
}
