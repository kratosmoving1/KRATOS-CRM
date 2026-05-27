export type ChargeType =
  | 'moving_labor'
  | 'transportation'
  | 'packing'
  | 'materials'
  | 'additional_services'
  | 'trip_and_travel'
  | 'fuel_surcharge'
  | 'valuation'
  | 'bulky_item'
  | 'storage'
  | 'storage_in_transit'

export interface MovingLaborConfig {
  num_trucks: number
  num_crew: number
  hourly_rate: number
  labor_hours: number
  travel_hours: number
  handicap_origin: number
  handicap_stops: number
  handicap_dest: number
  minimum_hours: number
}

export interface SimpleQuantityConfig {
  quantity: number
  unit_rate: number
}

export interface TripAndTravelConfig {
  distance_km: number
  rate_per_km: number
}

export interface FuelSurchargeConfig {
  percentage_of_labor?: number
  flat_amount?: number
  labor_subtotal?: number
}

export interface ValuationConfig {
  coverage_amount: number
  premium_rate: number
}

export interface StorageConfig {
  monthly_rate: number
  months: number
}

export interface StorageInTransitConfig {
  daily_rate: number
  num_days: number
}

export interface MovingLaborResult {
  total_hours: number
  billable_hours: number
  subtotal: number
}

export function calculateMovingLabor(c: MovingLaborConfig): MovingLaborResult {
  const total =
    c.labor_hours +
    c.travel_hours +
    c.handicap_origin +
    c.handicap_stops +
    c.handicap_dest
  const billable = Math.max(total, c.minimum_hours)
  const subtotal = +(billable * c.hourly_rate).toFixed(2)
  return { total_hours: +total.toFixed(2), billable_hours: +billable.toFixed(2), subtotal }
}

export function calculateQuantityRate(c: SimpleQuantityConfig): number {
  return +(c.quantity * c.unit_rate).toFixed(2)
}

export function calculateTripAndTravel(c: TripAndTravelConfig): number {
  return +(c.distance_km * c.rate_per_km).toFixed(2)
}

export function calculateFuelSurcharge(c: FuelSurchargeConfig): number {
  if (c.flat_amount != null && c.flat_amount > 0) {
    return +c.flat_amount.toFixed(2)
  }
  if (c.percentage_of_labor != null && c.labor_subtotal != null) {
    return +((c.percentage_of_labor / 100) * c.labor_subtotal).toFixed(2)
  }
  return 0
}

export function calculateValuation(c: ValuationConfig): number {
  return +((c.coverage_amount * c.premium_rate) / 100).toFixed(2)
}

export function calculateStorage(c: StorageConfig): number {
  return +(c.monthly_rate * c.months).toFixed(2)
}

export function calculateStorageInTransit(c: StorageInTransitConfig): number {
  return +(c.daily_rate * c.num_days).toFixed(2)
}

export interface DiscountResult {
  discount_amount: number
  total: number
}

export function applyDiscount(
  subtotal: number,
  discount_type: 'percent' | 'amount' | null,
  discount_value: number | null,
): DiscountResult {
  if (!discount_type || discount_value == null || discount_value <= 0) {
    return { discount_amount: 0, total: subtotal }
  }
  const discount_amount =
    discount_type === 'percent'
      ? +(subtotal * (discount_value / 100)).toFixed(2)
      : +discount_value.toFixed(2)
  const total = Math.max(0, +(subtotal - discount_amount).toFixed(2))
  return { discount_amount, total }
}

export interface EstimateTotals {
  subtotal: number
  total_discounts: number
  sales_tax: number
  estimate_total: number
}

export interface ChargeRow {
  subtotal: number
  discount_amount: number
  total: number
}

export function calculateEstimate(
  charges: ChargeRow[],
  tax_rate: number,
  tax_exempt: boolean,
): EstimateTotals {
  const chargesTotal = charges.reduce((s, c) => s + c.total, 0)
  const total_discounts = charges.reduce((s, c) => s + c.discount_amount, 0)
  const sales_tax = tax_exempt ? 0 : +(chargesTotal * tax_rate).toFixed(2)
  const estimate_total = +(chargesTotal + sales_tax).toFixed(2)
  return {
    subtotal: +chargesTotal.toFixed(2),
    total_discounts: +total_discounts.toFixed(2),
    sales_tax,
    estimate_total,
  }
}

export function computeSubtotalFromConfig(
  charge_type: ChargeType,
  config: Record<string, unknown>,
): number {
  switch (charge_type) {
    case 'moving_labor':
      return calculateMovingLabor(config as unknown as MovingLaborConfig).subtotal
    case 'transportation':
    case 'packing':
    case 'additional_services':
    case 'materials':
    case 'bulky_item':
      return calculateQuantityRate(config as unknown as SimpleQuantityConfig)
    case 'trip_and_travel':
      return calculateTripAndTravel(config as unknown as TripAndTravelConfig)
    case 'fuel_surcharge':
      return calculateFuelSurcharge(config as unknown as FuelSurchargeConfig)
    case 'valuation':
      return calculateValuation(config as unknown as ValuationConfig)
    case 'storage':
      return calculateStorage(config as unknown as StorageConfig)
    case 'storage_in_transit':
      return calculateStorageInTransit(config as unknown as StorageInTransitConfig)
    default:
      return 0
  }
}
