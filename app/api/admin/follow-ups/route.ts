import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, isAdminRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

const FOLLOW_UP_TYPES = ['call', 'email', 'sms', 'in_person', 'other'] as const

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, profile } = auth.context

  if (!hasPermission(profile.role, 'lead:create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const assignedToId = body.assigned_to_id ?? user.id

  if (typeof body.follow_up_date !== 'string' || !body.follow_up_date) {
    return NextResponse.json({ error: 'Follow-up date is required' }, { status: 400 })
  }
  if (!FOLLOW_UP_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Invalid follow-up type' }, { status: 400 })
  }
  if (assignedToId !== user.id && !isAdminRole(profile.role) && !hasPermission(profile.role, 'lead:update')) {
    return NextResponse.json({ error: 'Cannot assign follow-ups to another user' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('follow_ups')
    .insert({
      follow_up_date:  body.follow_up_date,
      follow_up_time:  body.follow_up_time ?? null,
      type:            body.type,
      notes:           body.notes ?? null,
      assigned_to_id:  assignedToId,
      created_by_id:   user.id,
      opportunity_id:  body.opportunity_id ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Follow-up create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'create',
    entityType: 'follow_up',
    entityId: data.id,
    oldData: null,
    newData: data as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(data, { status: 201 })
}
