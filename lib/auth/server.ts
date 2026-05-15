import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { hasPermission, isActiveUser, normalizeRole, type CrmRole, type Permission } from '@/lib/auth/permissions'

export type ActiveProfile = {
  id: string
  role: string
  is_active: boolean
}

export type AuthContext = {
  user: User
  profile: ActiveProfile
  role: CrmRole
}

export async function requireActiveProfile(
  supabase: SupabaseClient,
): Promise<{ context: AuthContext; response?: never } | { context?: never; response: NextResponse }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .single()

  if (error || !isActiveUser(profile)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const role = normalizeRole(profile.role)
  if (role === 'crew' || role === 'viewer') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { context: { user, profile: profile as ActiveProfile, role } }
}

export function forbiddenUnless(role: string | null | undefined, permission: Permission) {
  if (!hasPermission(role, permission)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
