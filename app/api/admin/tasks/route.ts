import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title:          body.title,
      description:    body.description ?? null,
      due_date:       body.due_date ?? null,
      due_time:       body.due_time ?? null,
      priority:       body.priority ?? 'normal',
      assigned_to_id: body.assigned_to_id ?? user.id,
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

  return NextResponse.json(data, { status: 201 })
}
