import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { logAuditEvent } from '@/lib/audit/logAuditEvent'
import type { Json } from '@/types/database'

function verifyStripeSignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false

  const parts = Object.fromEntries(
    signature.split(',').map(part => {
      const [key, value] = part.split('=')
      return [key, value]
    }),
  )

  const timestamp = parts.t
  const expected = parts.v1
  if (!timestamp || !expected) return false

  const signedPayload = `${timestamp}.${payload}`
  const digest = createHmac('sha256', secret).update(signedPayload).digest('hex')

  const expectedBuffer = Buffer.from(expected, 'hex')
  const digestBuffer = Buffer.from(digest, 'hex')
  if (expectedBuffer.length !== digestBuffer.length) return false

  return timingSafeEqual(expectedBuffer, digestBuffer)
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured yet.' }, { status: 503 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  const eventType = event.type as string
  const object = event.data?.object ?? {}
  const metadata = object.metadata ?? {}
  const opportunityId = metadata.opportunityId ?? object.client_reference_id ?? null

  await logAuditEvent({
    actorUserId: null,
    action: 'stripe_webhook_received',
    entityType: 'payment',
    entityId: opportunityId,
    oldData: null,
    newData: {
      stripeEventId: event.id,
      type: eventType,
      opportunityId,
      quoteId: metadata.quoteId ?? null,
      customerId: metadata.customerId ?? null,
    } as Json,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  })

  if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
    await logAuditEvent({
      actorUserId: null,
      action: 'payment_succeeded',
      entityType: 'payment',
      entityId: opportunityId,
      oldData: null,
      newData: {
        stripeEventId: event.id,
        type: eventType,
        stripeCheckoutSessionId: object.id ?? null,
        stripePaymentIntentId: object.payment_intent ?? object.id ?? null,
        opportunityId,
        amountTotal: object.amount_total ?? object.amount_received ?? null,
        currency: object.currency ?? 'cad',
      } as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
  }

  if (eventType === 'payment_intent.payment_failed') {
    await logAuditEvent({
      actorUserId: null,
      action: 'payment_failed',
      entityType: 'payment',
      entityId: opportunityId,
      oldData: null,
      newData: {
        stripeEventId: event.id,
        type: eventType,
        stripePaymentIntentId: object.id ?? null,
        opportunityId,
        failureMessage: object.last_payment_error?.message ?? null,
      } as Json,
      ipAddress: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
  }

  return NextResponse.json({ received: true })
}
