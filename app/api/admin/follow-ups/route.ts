import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('follow_ups')
    .insert({
      follow_up_date:  body.follow_up_date,
      follow_up_time:  body.follow_up_time ?? null,
      type:            body.type,
      notes:           body.notes ?? null,
      assigned_to_id:  body.assigned_to_id ?? user.id,
      created_by_id:   user.id,
      opportunity_id:  body.opportunity_id ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('Follow-up create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
