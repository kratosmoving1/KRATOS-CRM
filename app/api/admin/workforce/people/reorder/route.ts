import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: { id: string; column_id: string | null; position: number }[] = body.updates ?? []
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 })
  }

  const results = await Promise.all(
    updates.map(({ id, column_id, position }) =>
      supabase
        .from('workforce_people')
        .update({ column_id, position })
        .eq('id', id)
        .neq('is_deleted', true)
    )
  )

  const err = results.find(r => r.error)
  if (err?.error) return NextResponse.json({ error: err.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
