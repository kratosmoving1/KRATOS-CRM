import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

type Params = {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { user, role } = auth.context
  const normalizedRole = normalizeRole(role)

  if (normalizedRole !== 'owner' && normalizedRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const patch = {
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    subject: typeof body.subject === 'string' ? body.subject : null,
    body: typeof body.body === 'string' ? body.body : undefined,
    is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
  }

  if (!patch.name || !patch.body) {
    return NextResponse.json({ error: 'Template name and body are required.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('communication_templates')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'communication_template_updated',
    entityType: 'communication_template',
    entityId: data.id,
    oldData: null,
    newData: data as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(data)
}
