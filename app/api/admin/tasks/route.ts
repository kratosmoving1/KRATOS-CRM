import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, isAdminRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user, profile } = auth.context

  const body = await req.json()
  const assignedToId = body.assigned_to_id ?? user.id

  if (typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (body.priority && !TASK_PRIORITIES.includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }
  if (assignedToId !== user.id && !isAdminRole(profile.role) && !hasPermission(profile.role, 'job:update')) {
    return NextResponse.json({ error: 'Cannot assign tasks to another user' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title:          body.title.trim(),
      description:    body.description ?? null,
      due_date:       body.due_date ?? null,
      due_time:       body.due_time ?? null,
      priority:       body.priority ?? 'normal',
      assigned_to_id: assignedToId,
      created_by_id:  user.id,
      opportunity_id: body.opportunity_id ?? null,
      status:         'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Task create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'create',
    entityType: 'task',
    entityId: data.id,
    oldData: null,
    newData: data as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(data, { status: 201 })
}
