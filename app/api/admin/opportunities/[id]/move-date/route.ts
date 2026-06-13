import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermission, isActiveUser } from '@/lib/auth/permissions'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { sendEmail } from '@/lib/email/sendEmail'
import { buildRescheduleEmailHtml } from '@/lib/email/estimateEmailHtml'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import type { Json } from '@/types/database'

const COMPANY_PHONE = process.env.COMPANY_PHONE ?? '(800) 321-3222'

type CustomerRow = { full_name: string; email: string | null }[] | { full_name: string; email: string | null } | null
type AgentRow    = { full_name: string | null }[] | { full_name: string | null } | null

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function formatDateLabel(iso: string | null): string {
  if (!iso) return 'To be confirmed'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!isActiveUser(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [oppResult, portalLinkResult] = await Promise.all([
    admin
      .from('opportunities')
      .select('id, status, sales_agent_id, service_date, opportunity_number, service_type, origin_address_line1, origin_city, origin_province, dest_address_line1, dest_city, dest_province, customer:customers!customer_id(full_name, email), agent:profiles!sales_agent_id(full_name)')
      .eq('id', params.id)
      .not('is_deleted', 'is', 'true')
      .single(),
    admin
      .from('estimate_portal_links')
      .select('token')
      .eq('opportunity_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const opp = oppResult.data
  if (oppResult.error || !opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canUpdateAny      = hasPermission(profile?.role, 'lead:update')
  const canUpdateAssigned = opp.sales_agent_id === user.id && hasPermission(profile?.role, 'lead:update_assigned')
  if (!canUpdateAny && !canUpdateAssigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { serviceDate, tbd } = body
  const sendEmailFlag: boolean = body.sendEmail !== false
  const newDate = tbd ? null : (serviceDate || null)

  // Arrival window (movers' arrival time). Normalize "HH:MM" → "HH:MM:00" or null.
  const normalizeTime = (v: unknown): string | null => {
    if (typeof v !== 'string' || !v.trim()) return null
    const m = v.trim().match(/^(\d{1,2}):(\d{2})/)
    if (!m) return null
    return `${m[1].padStart(2, '0')}:${m[2]}:00`
  }
  // If the date is cleared (TBD), also clear the arrival window
  const arrivalStart = tbd ? null : normalizeTime(body.arrivalStart)
  const arrivalEnd   = tbd ? null : normalizeTime(body.arrivalEnd)

  // Only send reschedule email if the date actually changed
  const dateChanged = newDate !== opp.service_date

  const { data: updated, error } = await admin
    .from('opportunities')
    .update({
      service_date: newDate,
      arrival_window_start: arrivalStart,
      arrival_window_end: arrivalEnd,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('move-date PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Cascade date change to dispatch assignments so the dispatch board stays in sync.
  // Clear crew_id so the job shows as unscheduled on the new date (dispatcher re-assigns).
  if (dateChanged && newDate) {
    await admin
      .from('dispatch_job_assignments')
      .update({ scheduled_date: newDate, crew_id: null })
      .eq('opportunity_id', params.id)
      .eq('is_deleted', false)
  }

  await admin.from('audit_log').insert({
    user_id:     user.id,
    entity_type: 'opportunity',
    entity_id:   params.id,
    action:      'update',
    diff:        { event: 'opportunity_move_date_updated', from: opp.service_date, to: newDate },
  })

  await logAuditEvent({
    actorUserId: user.id,
    action: 'update',
    entityType: 'opportunity',
    entityId: params.id,
    oldData: { service_date: opp.service_date } as unknown as Json,
    newData: { service_date: newDate } as unknown as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  // Send reschedule email when date changes on an active booking (if agent opted in)
  const activeStatuses = ['opportunity', 'booked', 'completed']
  if (dateChanged && sendEmailFlag && activeStatuses.includes(opp.status ?? '')) {
    const customerRow = one(opp.customer as CustomerRow)
    const agentRow    = one(opp.agent as AgentRow)
    const custEmail   = customerRow?.email ?? null

    if (custEmail) {
      const customerName   = customerRow?.full_name ?? 'Customer'
      const firstName      = customerName.trim().split(/\s+/)[0] ?? customerName
      const agentParts     = agentRow?.full_name?.trim().split(/\s+/) ?? []
      const agentFirstName = agentParts[0] ?? ''
      const agentLastInitial = agentParts[1]?.[0] ?? ''
      const quoteNumber    = formatQuoteNumber(opp.opportunity_number)
      const portalToken    = portalLinkResult.data?.token
      const appOrigin      = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
      const portalLink     = portalToken ? `${appOrigin}/portal/estimate/${portalToken}` : undefined
      const origin         = [opp.origin_address_line1, opp.origin_city, opp.origin_province].filter(Boolean).join(', ')
      const destination    = [opp.dest_address_line1, opp.dest_city, opp.dest_province].filter(Boolean).join(', ')
      const serviceTypeLabel = String(opp.service_type ?? 'Moving').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

      const subject = `Your Move Date Has Been Updated — Kratos Moving #${quoteNumber}`
      const text    = `Hi ${firstName}, your Kratos Moving move date has been updated from ${formatDateLabel(opp.service_date)} to ${formatDateLabel(newDate)}. Questions? Call us at ${COMPANY_PHONE}.`
      const html    = buildRescheduleEmailHtml({
        customerFirstName: firstName,
        customerFullName:  customerName,
        quoteNumber,
        oldMoveDate:       formatDateLabel(opp.service_date),
        newMoveDate:       formatDateLabel(newDate),
        serviceType:       serviceTypeLabel,
        originAddress:     origin,
        destinationAddress: destination,
        companyPhone:      COMPANY_PHONE,
        agentFirstName,
        agentLastInitial,
        portalLink,
      })

      try {
        await sendEmail({
          to: custEmail,
          subject,
          text,
          html,
          fromName: 'Kratos Moving',
          fromEmail: process.env.EMAIL_FROM_DEFAULT ?? '',
        })
        await admin.from('communications').insert({
          opportunity_id: params.id,
          type:           'email',
          direction:      'outbound',
          subject,
          body:           html,
          email_to:       custEmail,
          created_by:     user.id,
        })
      } catch (err) {
        console.error('[move-date] reschedule email failed:', err)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    service_date: newDate,
    arrival_window_start: arrivalStart,
    arrival_window_end: arrivalEnd,
    opportunity: updated,
  })
}
