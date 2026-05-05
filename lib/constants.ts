export const SERVICE_TYPES = [
  { value: 'local',          label: 'Local' },
  { value: 'long_distance',  label: 'Long Distance' },
  { value: 'commercial',     label: 'Commercial' },
  { value: 'packing',        label: 'Packing' },
  { value: 'storage',        label: 'Storage' },
  { value: 'international',  label: 'International' },
] as const

export const MOVE_SIZES = [
  { value: 'studio',         label: 'Studio' },
  { value: '1_bed',          label: '1 Bedroom' },
  { value: '2_bed',          label: '2 Bedroom' },
  { value: '3_bed',          label: '3 Bedroom' },
  { value: '4_bed',          label: '4 Bedroom' },
  { value: '5_bed_plus',     label: '5 Bedroom+' },
  { value: 'small_office',   label: 'Small Office' },
  { value: 'medium_office',  label: 'Medium Office' },
  { value: 'large_office',   label: 'Large Office' },
  { value: 'pod',            label: 'POD' },
  { value: 'partial',        label: 'Partial' },
  { value: 'few_items',      label: 'Few Items' },
  { value: 'other',          label: 'Other' },
] as const

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
  { value: 'new_lead',   label: 'New Lead',    color: 'blue' },
  { value: 'contacted',  label: 'Contacted',   color: 'cyan' },
  { value: 'quote_sent', label: 'Quote Sent',  color: 'purple' },
  { value: 'accepted',   label: 'Accepted',    color: 'amber' },
  { value: 'booked',     label: 'Booked',      color: 'green' },
  { value: 'completed',  label: 'Completed',   color: 'emerald' },
  { value: 'cancelled',  label: 'Cancelled',   color: 'slate' },
  { value: 'lost',       label: 'Lost',        color: 'red' },
] as const

export type OppStatus = typeof OPP_STATUSES[number]['value']

export const STATUS_TRANSITIONS: Record<OppStatus, OppStatus[]> = {
  new_lead:   ['contacted', 'quote_sent', 'lost'],
  contacted:  ['quote_sent', 'accepted', 'lost'],
  quote_sent: ['accepted', 'booked', 'cancelled', 'lost'],
  accepted:   ['booked', 'cancelled', 'lost'],
  booked:     ['completed', 'cancelled'],
  completed:  [],
  cancelled:  ['new_lead'],
  lost:       ['new_lead'],
}

export const STATUS_TIMESTAMP_MAP: Partial<Record<OppStatus, string>> = {
  contacted:  'contacted_at',
  quote_sent: 'quote_sent_at',
  accepted:   'accepted_at',
  booked:     'booked_at',
  completed:  'completed_at',
  cancelled:  'cancelled_at',
  lost:       'lost_at',
}
