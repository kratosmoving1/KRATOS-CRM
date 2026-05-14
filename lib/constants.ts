export const SERVICE_TYPES = [
  { value: 'local',          label: 'Local' },
  { value: 'long_distance',  label: 'Long Distance' },
  { value: 'commercial',     label: 'Commercial' },
  { value: 'packing',        label: 'Packing' },
  { value: 'storage',        label: 'Storage' },
  { value: 'international',  label: 'International' },
] as const

export const MOVE_SIZE_GROUPS = [
  {
    label: 'Houses',
    options: [
      { value: '1_bedroom_house',     label: '1 Bedroom House' },
      { value: '2_bedroom_house',     label: '2 Bedroom House' },
      { value: '3_bedroom_house',     label: '3 Bedroom House' },
      { value: '4_bedroom_house',     label: '4 Bedroom House' },
      { value: '5_bedroom_house_plus', label: '5+ Bedroom House' },
    ],
  },
  {
    label: 'Apartments / Condos',
    options: [
      { value: 'studio_apartment',    label: 'Studio Apartment' },
      { value: '1_bedroom_apartment', label: '1 Bedroom Apartment' },
      { value: '2_bedroom_apartment', label: '2 Bedroom Apartment' },
      { value: '3_bedroom_apartment', label: '3 Bedroom Apartment' },
      { value: '4_bedroom_apartment', label: '4 Bedroom Apartment' },
    ],
  },
  {
    label: 'Storage Units',
    options: [
      { value: 'storage_5x5',   label: '5×5 Storage' },
      { value: 'storage_5x10',  label: '5×10 Storage' },
      { value: 'storage_10x10', label: '10×10 Storage' },
      { value: 'storage_10x15', label: '10×15 Storage' },
      { value: 'storage_10x20', label: '10×20 Storage' },
      { value: 'storage_10x25', label: '10×25 Storage' },
      { value: 'storage_10x30', label: '10×30 Storage' },
    ],
  },
  {
    label: 'Office',
    options: [
      { value: 'small_office',  label: 'Small Office' },
      { value: 'medium_office', label: 'Medium Office' },
      { value: 'large_office',  label: 'Large Office' },
    ],
  },
  {
    label: 'Other',
    options: [
      { value: 'pod',        label: 'POD' },
      { value: 'partial',    label: 'Partial Move' },
      { value: 'few_items',  label: 'Few Items' },
      { value: 'other',      label: 'Other' },
    ],
  },
] as const

export const MOVE_SIZE_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    MOVE_SIZE_GROUPS.flatMap(g => g.options.map(o => [o.value, o.label]))
  ),
  // Legacy values from seed data — kept for backward compat display
  studio:         'Studio',
  '1_bed':        '1 Bedroom',
  '2_bed':        '2 Bedroom',
  '3_bed':        '3 Bedroom',
  '4_bed':        '4 Bedroom',
  '5_bed_plus':   '5+ Bedroom',
  '1_bedroom':    '1 Bedroom',
  '2_bedroom':    '2 Bedroom',
  '3_bedroom':    '3 Bedroom',
  '4_bedroom':    '4 Bedroom',
  '5_bedroom_plus': '5+ Bedroom',
}

// Legacy flat list — kept so any code referencing MOVE_SIZES still compiles
export const MOVE_SIZES: ReadonlyArray<{ value: string; label: string }> =
  MOVE_SIZE_GROUPS.flatMap(g => g.options.map(o => ({ value: o.value as string, label: o.label as string })))

export const PHONE_TYPES = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'home',   label: 'Home' },
  { value: 'work',   label: 'Work' },
] as const

export const DWELLING_TYPES = [
  { value: 'house',     label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo',     label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'storage',   label: 'Storage Unit' },
  { value: 'office',    label: 'Office' },
  { value: 'other',     label: 'Other' },
] as const

export const CANADIAN_PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
] as const

export const TASK_PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const

export const FOLLOW_UP_TYPES = [
  { value: 'call',      label: 'Call' },
  { value: 'email',     label: 'Email' },
  { value: 'sms',       label: 'SMS' },
  { value: 'in_person', label: 'In-person' },
  { value: 'other',     label: 'Other' },
] as const

export const OPP_STATUSES = [
  { value: 'opportunity', label: 'Opportunity', color: 'green' },
  { value: 'booked',      label: 'Booked',      color: 'orange' },
  { value: 'completed',   label: 'Completed',   color: 'blue' },
  { value: 'closed',      label: 'Closed',      color: 'slate' },
  { value: 'cancelled',   label: 'Cancelled',   color: 'red' },
] as const

export type OppStatus = typeof OPP_STATUSES[number]['value']

export const STATUS_TRANSITIONS: Record<OppStatus, OppStatus[]> = {
  opportunity: ['booked', 'cancelled'],
  booked:      ['completed', 'cancelled'],
  completed:   ['closed', 'cancelled'],
  closed:      [],
  cancelled:   ['opportunity'],
}

export const STATUS_TIMESTAMP_MAP: Partial<Record<OppStatus, string>> = {
  booked:    'booked_at',
  completed: 'completed_at',
  closed:    'closed_at',
  cancelled: 'cancelled_at',
}

export const MOVE_SIZE_VOLUME: Record<string, { cuft: number; lbs: number }> = {
  studio:        { cuft: 250,  lbs: 1750 },
  '1_bed':       { cuft: 500,  lbs: 3500 },
  '2_bed':       { cuft: 800,  lbs: 5600 },
  '3_bed':       { cuft: 1100, lbs: 7700 },
  '4_bed':       { cuft: 1400, lbs: 9800 },
  '5_bed_plus':  { cuft: 1700, lbs: 11900 },
  small_office:  { cuft: 500,  lbs: 3500 },
  medium_office: { cuft: 900,  lbs: 6300 },
  large_office:  { cuft: 1400, lbs: 9800 },
  pod:           { cuft: 200,  lbs: 1400 },
  partial:       { cuft: 300,  lbs: 2100 },
  few_items:     { cuft: 100,  lbs: 700  },
  other:         { cuft: 500,  lbs: 3500 },
}
