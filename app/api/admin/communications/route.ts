import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (!body.opportunity_id && !body.customer_id) {
    return NextResponse.json({ error: 'opportunity_id or customer_id required' }, { status: 400 })
  }
  if (!body.type || !['note','email','call','sms'].includes(body.type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('communications')
    .insert({
      opportunity_id:        body.opportunity_id ?? null,
      customer_id:           body.customer_id ?? null,
      type:                  body.type,
      direction:             body.direction ?? 'outbound',
      subject:               body.subject ?? null,
      body:                  body.body,
      call_outcome:          body.call_outcome ?? null,
      call_duration_seconds: body.call_duration_seconds ?? null,
      email_to:              body.email_to ?? null,
      email_cc:              body.email_cc ?? null,
      created_by:            user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Communications POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
