import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActiveUser } from '@/lib/auth/permissions'
import { sendEmail, isEmailConfigured } from '@/lib/email/sendEmail'
import { buildCustomerConfirmationEmail } from '@/lib/email/dispatchEmails'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}
function time12(t: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return null
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, '0')} ${period}`
}
function arrivalLabel(s: string | null, e: string | null): string {
  const a = time12(s), b = time12(e)
  if (a && b) return `${a} – ${b}`
  return a ?? b ?? 'TBD'
}
function one<T>(v: T | T[] | null): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!isActiveUser(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const assignmentId: string | undefined = body.assignmentId
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: assignment, error } = await admin
    .from('dispatch_job_assignments')
    .select(`
      id, scheduled_date,
      opportunity:opportunities!opportunity_id(
        id, opportunity_number, arrival_window_start, arrival_window_end,
        origin_address_line1, origin_city, origin_province,
        dest_address_line1, dest_city, dest_province,
        customer:customers!customer_id(id, full_name, email)
      )
    `)
    .eq('id', assignmentId)
    .maybeSingle()

  if (error || !assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  type Opp = {
    id: string; opportunity_number: string
    arrival_window_start: string | null; arrival_window_end: string | null
    origin_address_line1: string | null; origin_city: string | null; origin_province: string | null
    dest_address_line1: string | null; dest_city: string | null; dest_province: string | null
    customer: { id: string; full_name: string; email: string | null } | { id: string; full_name: string; email: string | null }[] | null
  }
  const opp = one(assignment.opportunity as unknown as Opp | Opp[] | null)
  const customer = one(opp?.customer ?? null)

  if (!customer?.email) {
    return NextResponse.json({ error: 'Customer has no email address on file.' }, { status: 422 })
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'Email is not configured on this server.' }, { status: 422 })
  }

  const firstName = (customer.full_name ?? '').split(' ')[0] || 'there'
  const origin = [opp?.origin_address_line1, opp?.origin_city, opp?.origin_province].filter(Boolean).join(', ')
  const dest = [opp?.dest_address_line1, opp?.dest_city, opp?.dest_province].filter(Boolean).join(', ')

  const { subject, html, text } = buildCustomerConfirmationEmail({
    customerFirstName: firstName,
    quoteNumber: formatQuoteNumber(opp?.opportunity_number ?? ''),
    dateLabel: fmtDate(assignment.scheduled_date),
    arrivalLabel: arrivalLabel(opp?.arrival_window_start ?? null, opp?.arrival_window_end ?? null),
    origin, destination: dest,
  })

  try {
    await sendEmail({ to: customer.email, subject, html, text, fromName: 'Kratos Moving' })
  } catch (e) {
    return NextResponse.json({ error: `Email failed: ${e instanceof Error ? e.message : 'unknown error'}` }, { status: 500 })
  }

  const now = new Date().toISOString()
  await admin
    .from('dispatch_job_assignments')
    .update({ customer_confirmed_at: now, customer_confirmed_by: user.id })
    .eq('id', assignmentId)

  // Log to the sales timeline
  if (opp?.id) {
    await admin.from('communications').insert({
      opportunity_id: opp.id,
      customer_id: customer.id,
      type: 'email',
      direction: 'outbound',
      subject,
      body: html,
      email_to: customer.email,
      created_by: user.id,
    })
  }

  return NextResponse.json({ ok: true, customer_confirmed_at: now })
}
