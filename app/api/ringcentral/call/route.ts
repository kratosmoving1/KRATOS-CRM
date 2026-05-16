import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import { requireActiveProfile } from '@/lib/auth/server'
import { normalizeRole, type CrmRole } from '@/lib/auth/permissions'
import {
  isRingCentralConfigured,
  normalizePhoneToE164,
  startRingCentralCall,
} from '@/lib/ringcentral/client'
import type { Json } from '@/types/database'

const CALL_ALLOWED_ROLES: CrmRole[] = ['owner', 'admin', 'manager', 'sales', 'dispatcher']

type RingCentralCallBody = {
  opportunityId?: string | null
  customerId?: string | null
  phoneNumber?: string | null
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function writeCallActivity({
  opportunityId,
  customerId,
  phoneNumber,
  status,
  createdBy,
  body,
}: {
  opportunityId: string | null
  customerId: string | null
  phoneNumber: string
  status: 'initiated' | 'failed'
  createdBy: string
  body: string
}) {
  const supabase = createClient()
  return supabase
    .from('communications')
    .insert({
      opportunity_id: opportunityId,
      customer_id: customerId,
      type: 'call',
      direction: 'outbound',
      subject: 'RingCentral call',
      body,
      call_outcome: null,
      call_duration_seconds: null,
      email_to: null,
      email_cc: null,
      phone_number: phoneNumber,
      status,
      created_by: createdBy,
    })
    .select()
    .single()
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { user, role } = auth.context
  const normalizedRole = normalizeRole(role)

  if (!CALL_ALLOWED_ROLES.includes(normalizedRole)) {
    return jsonError('Forbidden', 403)
  }

  let body: RingCentralCallBody
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid request body.', 400)
  }

  const opportunityId = body.opportunityId ?? null
  const customerId = body.customerId ?? null
  const rawPhoneNumber = body.phoneNumber?.trim()

  if (!opportunityId && !customerId) {
    return jsonError('opportunityId or customerId required.', 400)
  }

  if (!rawPhoneNumber) {
    return jsonError('phoneNumber is required.', 400)
  }

  const phoneNumber = normalizePhoneToE164(rawPhoneNumber)
  const auditContext = {
    actorUserId: user.id,
    entityType: 'ringcentral_call',
    entityId: opportunityId ?? customerId,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  }
  const callMetadata = {
    opportunityId,
    customerId,
    phoneNumber,
  } satisfies Json

  await logAuditEvent({
    ...auditContext,
    action: 'ringcentral_call_attempted',
    newData: callMetadata,
  })

  if (!isRingCentralConfigured()) {
    const { data: failedActivity } = await writeCallActivity({
      opportunityId,
      customerId,
      phoneNumber,
      status: 'failed',
      createdBy: user.id,
      body: 'RingCentral call failed: RingCentral is not configured.',
    })

    await logAuditEvent({
      ...auditContext,
      action: 'ringcentral_call_failed',
      entityId: failedActivity?.id ?? auditContext.entityId,
      newData: {
        ...callMetadata,
        reason: 'RingCentral is not configured.',
      } satisfies Json,
    })

    return jsonError('RingCentral is not configured.', 503)
  }

  try {
    const result = await startRingCentralCall({ to: phoneNumber })
    const { data: activity, error: activityError } = await writeCallActivity({
      opportunityId,
      customerId,
      phoneNumber,
      status: 'initiated',
      createdBy: user.id,
      body: 'RingCentral outbound call initiated.',
    })

    if (activityError) {
      console.error('RingCentral communication activity insert failed:', activityError)
    }

    await logAuditEvent({
      ...auditContext,
      action: 'ringcentral_call_started',
      entityId: activity?.id ?? auditContext.entityId,
      newData: {
        ...callMetadata,
        ringCentralId: result.id ?? null,
        ringCentralStatus: result.status ?? null,
      } satisfies Json,
    })

    return NextResponse.json({
      ok: true,
      status: 'initiated',
      communicationId: activity?.id ?? null,
      ringCentralId: result.id ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to start RingCentral call.'
    const { data: failedActivity } = await writeCallActivity({
      opportunityId,
      customerId,
      phoneNumber,
      status: 'failed',
      createdBy: user.id,
      body: `RingCentral call failed: ${message}`,
    })

    await logAuditEvent({
      ...auditContext,
      action: 'ringcentral_call_failed',
      entityId: failedActivity?.id ?? auditContext.entityId,
      newData: {
        ...callMetadata,
        reason: message,
      } satisfies Json,
    })

    console.error('RingCentral call failed:', err)
    return jsonError('Unable to start call.', 502)
  }
}
