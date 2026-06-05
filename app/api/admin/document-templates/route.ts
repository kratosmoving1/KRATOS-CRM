import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

const ALLOWED = ['name', 'category', 'description', 'content_html', 'content_json', 'status']

function strip(body: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
}

export async function GET() {
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
    .neq('is_deleted', true)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('document-templates GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const cleaned = strip(body)

  if (!cleaned.name?.toString().trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!cleaned.category) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }

  const isPublished = cleaned.status === 'published'

  const payload = {
    ...cleaned,
    name: cleaned.name.toString().trim(),
    description: cleaned.description ? cleaned.description.toString().trim() || null : null,
    content_html: cleaned.content_html?.toString() ?? '',
    status: cleaned.status ?? 'draft',
    created_by: user.id,
    updated_by: user.id,
    ...(isPublished ? { published_by: user.id, published_at: new Date().toISOString() } : {}),
  }

  const { data: created, error } = await supabase
    .from('document_templates')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('document-templates POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'create',
    entityType: 'document_template',
    entityId: created.id,
    oldData: null,
    newData: created as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(created, { status: 201 })
}
