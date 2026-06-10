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
  license_plate: string | null
  liftgate: boolean
  ramp: boolean
  status: string  // 'active' | 'inactive' | 'maintenance'
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at: string | null
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

// ─── Dispatch Crew types (B1.5) ───────────────────────────────────────────────

export interface DispatchCrewPerson {
  id: string
  name: string
  profile_picture_url: string | null
}

export interface DispatchCrewTruck {
  id: string
  name: string
  category: string
  size: string
  provider: string | null
}

export interface DispatchCrewHelper {
  person: DispatchCrewPerson
}

export interface DispatchCrewAssignment {
  id: string
  opportunity_id: string
  crew_id: string
  scheduled_date: string
  start_time: string
  duration_hours: number
  position: number
  is_deleted?: boolean
  opportunity?: {
    id: string
    opportunity_number?: string | null
    move_size: string | null
    origin_city: string | null
    dest_city: string | null
    total_amount: number | null
    customer: { id: string; full_name: string } | null
  }
}

export interface DispatchCrew {
  id: string
  scheduled_date: string
  position: number
  name: string
  truck_id: string | null
  driver_id: string | null
  dispatcher_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  deleted_at: string | null
  truck: DispatchCrewTruck | null
  driver: DispatchCrewPerson | null
  dispatcher: DispatchCrewPerson | null
  helpers: DispatchCrewHelper[]
  assignments: DispatchCrewAssignment[]
}

export interface DayDetailData {
  trucks: DispatchTruck[]
  crew_people: DispatchCrewMember[]
  events: DispatchCalendarEvent[]
  cancelled_events: DispatchCalendarEvent[]
  crews: DispatchCrew[]
}
