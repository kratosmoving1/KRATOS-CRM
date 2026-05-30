/**
 * Admin-facing tariff helpers.
 * Re-exports TARIFF_PACKAGES and provides a flat list of all move sizes
 * with their recommendations for the Settings → Tariffs table.
 */

export { TARIFF_PACKAGES } from './packages'
import { recommendPackage } from './packages'

// All move sizes from constants, in display order, with their recommendations
const ALL_MOVE_SIZES: { value: string; label: string }[] = [
  { value: 'studio_apartment',    label: 'Studio Apartment' },
  { value: '1_bedroom_apartment', label: '1 Bedroom Apartment' },
  { value: '2_bedroom_apartment', label: '2 Bedroom Apartment' },
  { value: '3_bedroom_apartment', label: '3 Bedroom Apartment' },
  { value: '4_bedroom_apartment', label: '4 Bedroom Apartment' },
  { value: '1_bedroom_house',     label: '1 Bedroom House' },
  { value: '2_bedroom_house',     label: '2 Bedroom House' },
  { value: '3_bedroom_house',     label: '3 Bedroom House' },
  { value: '4_bedroom_house',     label: '4 Bedroom House' },
  { value: '5_bedroom_house_plus', label: '5+ Bedroom House' },
  { value: 'office',              label: 'Office' },
  { value: 'storage',             label: 'Storage Unit' },
]

export const MOVE_SIZE_GROUPS_WITH_RECOMMENDATIONS = ALL_MOVE_SIZES.map(s => {
  const rec = recommendPackage(s.value)
  return {
    value: s.value,
    label: s.label,
    primary: rec?.primary ?? 'silver',
    alternative: rec?.alternative ?? null,
    note: rec?.note ?? null,
  }
})
