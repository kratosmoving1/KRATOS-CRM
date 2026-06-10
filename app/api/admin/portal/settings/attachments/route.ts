import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { role } = auth.context
  const normalizedRole = normalizeRole(role)
  if (!['owner', 'admin', 'manager'].includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const file_url = typeof body.file_url === 'string' ? body.file_url.trim() : ''

  if (!name || !file_url) {
    return NextResponse.json({ error: 'name and file_url are required' }, { status: 400 })
  }

  const { data: settings } = await supabase
    .from('customer_portal_settings')
    .select('id')
    .maybeSingle()

  if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 404 })

  const { data: lastRow } = await supabase
    .from('customer_portal_attachments')
    .select('position')
    .eq('settings_id', settings.id)
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = lastRow ? (lastRow.position + 1) : 0

  const { data, error } = await supabase
    .from('customer_portal_attachments')
    .insert({ settings_id: settings.id, name, file_url, position })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
