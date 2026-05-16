import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizeRole } from '@/lib/auth/permissions'

const VIEW_ROLES = ['owner', 'admin', 'manager'] as const

export async function GET() {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const role = normalizeRole(auth.context.role)
  if (!VIEW_ROLES.includes(role as typeof VIEW_ROLES[number])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('communication_templates')
    .select('*')
    .order('channel')
    .order('trigger')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    templates: data ?? [],
    canEdit: role === 'owner' || role === 'admin',
  })
}
