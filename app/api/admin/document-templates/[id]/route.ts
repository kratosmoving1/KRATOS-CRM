import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

const ALLOWED = ['name', 'category', 'description', 'content_html', 'content_json', 'status']

function strip(body: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('document_templates')
    .select(`
      *,
      creator:profiles!created_by(full_name),
      updater:profiles!updated_by(full_name),
      publisher:profiles!published_by(full_name)
    `)
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch current record for audit log and published_at guard
  const { data: existing } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const cleaned = strip(body)

  const isNowPublished = cleaned.status === 'published'
  const wasPublished = existing.status === 'published'

  const updatePayload = {
    ...cleaned,
    ...(cleaned.name ? { name: cleaned.name.toString().trim() } : {}),
    ...(cleaned.description !== undefined ? { description: cleaned.description?.toString().trim() || null } : {}),
    updated_by: user.id,
    ...(isNowPublished && !wasPublished
      ? { published_by: user.id, published_at: new Date().toISOString() }
      : {}),
  }

  const { data: updated, error } = await supabase
    .from('document_templates')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('document-templates PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'update',
    entityType: 'document_template',
    entityId: params.id,
    oldData: existing as unknown as Json,
    newData: updated as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabase
    .from('document_templates')
    .select('id, name')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('document_templates')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'delete',
    entityType: 'document_template',
    entityId: params.id,
    oldData: existing as unknown as Json,
    newData: null,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return new NextResponse(null, { status: 204 })
}
