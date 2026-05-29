import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireActiveProfile } from '@/lib/auth/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response
  const { user } = auth.context

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const opportunityId = (body.quoteId ?? body.opportunityId ?? null) as string | null
  const customerId = (body.customerId ?? null) as string | null
  const text = typeof body.body === 'string' ? body.body.trim() : null

  if (!opportunityId && !customerId) {
    return NextResponse.json({ error: 'quoteId or customerId required' }, { status: 400 })
  }
  if (!text) return NextResponse.json({ error: 'Message body required' }, { status: 400 })

  const { data, error } = await supabase
    .from('communications')
    .insert({
      opportunity_id: opportunityId,
      customer_id: customerId,
      type: 'sms',
      direction: 'outbound',
      body: text,
      created_by: user.id,
      status: 'logged_only',
    })
    .select()
    .single()

  if (error) {
    // Fallback: some columns may not exist; save minimal record
    const { data: fallback, error: fallbackErr } = await supabase
      .from('communications')
      .insert({
        opportunity_id: opportunityId,
        customer_id: customerId,
        type: 'sms',
        direction: 'outbound',
        body: text,
        created_by: user.id,
      })
      .select()
      .single()

    if (fallbackErr) {
      console.error('SMS log insert failed:', fallbackErr)
      return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
    }

    await logAuditEvent({
      actorUserId: user.id,
      action: 'sms_logged_only',
      entityType: 'communication',
      entityId: fallback?.id ?? opportunityId ?? customerId,
      newData: { opportunityId, customerId, note: 'SMS logged without sending' } as unknown as Json,
    })

    return NextResponse.json({ ok: true, loggedOnly: true, comm: fallback }, { status: 201 })
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'sms_logged_only',
    entityType: 'communication',
    entityId: data?.id ?? opportunityId ?? customerId,
    newData: { opportunityId, customerId, note: 'SMS logged without sending' } as unknown as Json,
  })

  return NextResponse.json({ ok: true, loggedOnly: true, comm: data }, { status: 201 })
}
