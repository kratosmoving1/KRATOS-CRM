import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const role = normalizeRole(auth.context.role)
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, channel, trigger, subject, body: templateBody } = body

  if (!name?.trim() || !['email', 'sms', 'call'].includes(channel) || !templateBody?.trim()) {
    return NextResponse.json({ error: 'Name, channel, and body are required.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('communication_templates')
    .insert({
      name: name.trim(),
      channel,
      trigger: (trigger ?? 'sales').trim(),
      subject: channel === 'email' ? (subject?.trim() || null) : null,
      body: templateBody.trim(),
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
