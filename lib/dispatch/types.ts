import type { DispatchCalendarEvent } from './calendar'

export type TruckCategory = 'owned' | 'rental' | 'contractor'
export type TruckSize = 'cargo_van' | '10ft' | '15ft' | '16ft' | '20ft' | '26ft'

export interface DispatchTruck {
  id: string
  name: string
  category: TruckCategory
  provider: string | null
  size: string
  notes: string | null
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at: string | null
}

export interface AssignmentOpportunity {
  id: string
  move_size: string | null
  origin_city: string | null
  dest_city: string | null
  total_amount: number | null
  customer: {
    id: string
    full_name: string
  } | null
}

export interface DispatchJobAssignment {
  id: string
  opportunity_id: string
  truck_id: string | null
  scheduled_date: string
  start_time: string
  duration_hours: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at: string | null
  opportunity?: AssignmentOpportunity
}

export interface DispatchCrewMember {
  id: string
  name: string
  role: string | null
  profile_picture_url: string | null
  role_data: { id: string; key: string; label: string; color: string } | null
  status: { id: string; key: string; label: string; color: string } | null
  tier: { id: string; key: string; label: string; color: string } | null
}

export interface DayDetailData {
  trucks: DispatchTruck[]
  crew: DispatchCrewMember[]
  events: DispatchCalendarEvent[]
  assignments: DispatchJobAssignment[]
}
