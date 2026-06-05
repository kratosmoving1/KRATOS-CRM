import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: source } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: copy, error } = await supabase
    .from('document_templates')
    .insert({
      name: `${source.name} (Copy)`,
      category: source.category,
      description: source.description,
      content_html: source.content_html,
      content_json: source.content_json,
      status: 'draft',
      published_by: null,
      published_at: null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('document-templates duplicate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'create',
    entityType: 'document_template',
    entityId: copy.id,
    oldData: null,
    newData: copy as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json(copy, { status: 201 })
}
