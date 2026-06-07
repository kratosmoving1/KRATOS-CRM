import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const order: { id: string; position: number }[] = body.order ?? []
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: 'order array required' }, { status: 400 })
  }

  const updates = await Promise.all(
    order.map(({ id, position }) =>
      supabase
        .from('workforce_columns')
        .update({ position })
        .eq('id', id)
        .neq('is_deleted', true)
    )
  )

  const err = updates.find(r => r.error)
  if (err?.error) return NextResponse.json({ error: err.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
