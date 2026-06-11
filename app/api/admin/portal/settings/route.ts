import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'

type AttachmentRow    = { id: string; name: string; file_url: string; position: number; is_deleted: boolean }
type BadgeRow         = { id: string; name: string; image_url: string | null; position: number; is_deleted: boolean }
type ContentBlockRow  = { id: string; section_type: string; title: string | null; body: string | null; data: Record<string, unknown>; position: number; is_visible: boolean; is_deleted: boolean }

export async function GET(req: NextRequest) {
  void req
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const [settingsResult, blocksResult] = await Promise.all([
    supabase
      .from('customer_portal_settings')
      .select(`
        *,
        attachments:customer_portal_attachments(id, name, file_url, position, is_deleted),
        badges:customer_portal_badges(id, name, image_url, position, is_deleted)
      `)
      .maybeSingle(),
    supabase
      .from('customer_portal_content_blocks')
      .select('id, section_type, title, body, data, position, is_visible, is_deleted')
      .eq('is_deleted', false)
      .order('position', { ascending: true }),
  ])

  if (settingsResult.error) return NextResponse.json({ error: settingsResult.error.message }, { status: 500 })
  if (!settingsResult.data) return NextResponse.json({ error: 'Not configured' }, { status: 404 })

  const data = settingsResult.data
  const result = {
    ...data,
    attachments: ((data.attachments as unknown as AttachmentRow[]) ?? [])
      .filter(a => !a.is_deleted)
      .sort((a, b) => a.position - b.position),
    badges: ((data.badges as unknown as BadgeRow[]) ?? [])
      .filter(b => !b.is_deleted)
      .sort((a, b) => a.position - b.position),
    content_blocks: ((blocksResult.data ?? []) as ContentBlockRow[])
      .map(({ id, section_type, title, body, data: bdata, position, is_visible }) =>
        ({ id, section_type, title, body, data: bdata ?? {}, position, is_visible })
      ),
  }

  return NextResponse.json(result)
}

const ALLOWED_PATCH = [
  'company_name', 'company_phone', 'logo_url',
  'header_notes', 'footer_notes',
  'show_inventory_button', 'show_download_button',
  'show_materials_section', 'show_protection_section',
  'require_deposit', 'allow_accept_without_deposit',
]

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { role } = auth.context
  const normalizedRole = normalizeRole(role)
  if (!['owner', 'admin', 'manager'].includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as Record<string, unknown>
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ALLOWED_PATCH) {
    if (key in body) patch[key] = body[key]
  }

  // Get the single settings row id
  const { data: existing } = await supabase
    .from('customer_portal_settings')
    .select('id')
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Settings not found' }, { status: 404 })

  const { error } = await supabase
    .from('customer_portal_settings')
    .update(patch)
    .eq('id', existing.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
