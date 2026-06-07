export interface WorkforceStatus {
  id: string
  key: string
  label: string
  color: string
  position: number
}

export interface WorkforceTier {
  id: string
  key: string
  label: string
  color: string
  position: number
}

export interface WorkforceColumn {
  id: string
  name: string
  position: number
  color: string | null
}

export interface WorkforcePerson {
  id: string
  name: string
  role: string | null
  status_id: string | null
  tier_id: string | null
  tenure_started_at: string | null
  referred_by: string | null
  column_id: string | null
  position: number
  notes: string | null
  status?: WorkforceStatus | null
  tier?: WorkforceTier | null
}

export interface BoardState {
  columns: WorkforceColumn[]
  people: WorkforcePerson[]
  statuses: WorkforceStatus[]
  tiers: WorkforceTier[]
}
