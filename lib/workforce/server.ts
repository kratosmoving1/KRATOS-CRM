import { createClient } from '@/lib/supabase/server'
import type { BoardState } from './types'

export async function fetchBoardState(): Promise<BoardState> {
  const supabase = createClient()

  const [colRes, peopleRes, statusRes, tierRes, roleRes, locationRes] = await Promise.all([
    supabase
      .from('workforce_columns')
      .select('id, name, position, color')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_people')
      .select(`
        id, name, role, role_id, location_id, english_proficiency, profile_picture_url,
        status_id, tier_id, tenure_started_at, referred_by, column_id, position, notes,
        status:workforce_statuses(id,key,label,color,position),
        tier:workforce_tiers(id,key,label,color,position),
        role_data:workforce_roles(id,key,label,color,position),
        location:workforce_locations(id,key,label,color,position)
      `)
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_statuses')
      .select('id, key, label, color, position')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_tiers')
      .select('id, key, label, color, position')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_roles')
      .select('id, key, label, color, position')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
    supabase
      .from('workforce_locations')
      .select('id, key, label, color, position')
      .neq('is_deleted', true)
      .order('position', { ascending: true }),
  ])

  return {
    columns: (colRes.data ?? []) as BoardState['columns'],
    people: (peopleRes.data ?? []) as unknown as BoardState['people'],
    statuses: (statusRes.data ?? []) as BoardState['statuses'],
    tiers: (tierRes.data ?? []) as BoardState['tiers'],
    roles: (roleRes.data ?? []) as unknown as BoardState['roles'],
    locations: (locationRes.data ?? []) as unknown as BoardState['locations'],
  }
}
