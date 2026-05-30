'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Diagnostics = {
  googleMaps?: {
    configured: boolean
    hasPublicKey: boolean
    hasServerKey: boolean
    status: string
    message: string
  }
  sms?: {
    provider: string
    canSend: boolean
    reason?: string | null
    recommendation?: string | null
    envVars?: {
      SMS_PROVIDER?:       { present: boolean; value?: string | null }
      TWILIO_ACCOUNT_SID?: { present: boolean }
      TWILIO_AUTH_TOKEN?:  { present: boolean }
      TWILIO_FROM_NUMBER?: { present: boolean; masked?: string | null }
    }
  }
  resend: {
    configured: boolean
    status: string
    message: string
    fromDefault?: string | null
    replyToDefault?: string | null
  }
  ringcentral: {
    configured: boolean
    authStatus: string
    message: string
    serverUrl: string
    scopes: string[]
    authenticatedExtension: null | {
      extensionNumber?: string
      name?: string
      email?: string
    }
    fromNumber: {
      value: string
      ownedByAuthenticatedExtension: boolean
      callCapable: boolean
    }
    smsFromNumber?: {
      value: string
      ownedByAuthenticatedExtension: boolean
      smsCapable: boolean
      message: string
    }
  }
  ringcentralUser: {
    connected: boolean
    setupRequired: boolean
    message: string
    redirectUri: string
    display_name?: string | null
    extension_number?: string | null
    call_from_number?: string | null
    sms_from_number?: string | null
    updated_at?: string | null
  }
  stripe: {
    configured: boolean
    status: string
    mode?: string
    message: string
  }
  portal: {
    appUrlPresent: boolean
    portalBaseUrl: string | null
    estimatePortalLinksTable: { available: boolean; message: string }
    estimateSignaturesTable: { available: boolean; message: string }
  }
}

function toneFor(status: string | boolean) {
  if (status === true || status === 'ok') return 'emerald'
  if (status === false || status === 'error' || status === 'not_configured') return 'red'
  return 'amber'
}

function StatusBadge({ status, label }: { status: string | boolean; label?: string }) {
  const tone = toneFor(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'emerald' && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        tone === 'red' && 'bg-red-50 text-red-700 ring-1 ring-red-200',
        tone === 'amber' && 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      )}
    >
      {tone === 'emerald' ? <CheckCircle2 size={12} /> : tone === 'red' ? <XCircle size={12} /> : <AlertCircle size={12} />}
      {label ?? (typeof status === 'boolean' ? (status ? 'Connected' : 'Needs setup') : status.replace(/_/g, ' '))}
    </span>
  )
}

function IntegrationCard({
  icon,
  title,
  description,
  status,
  statusLabel,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  status: string | boolean
  statusLabel?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-950">{title}</h2>
              <StatusBadge status={status} label={statusLabel} />
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="mt-1 truncate text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}

function SetupNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {children}
    </div>
  )
}

export default function IntegrationDiagnosticsClient() {
  const searchParams = useSearchParams()
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [disconnectingRingCentral, setDisconnectingRingCentral] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/integrations/diagnostics', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to load integrations.')
      setDiagnostics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load integrations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const message = searchParams.get('message')
    const status = searchParams.get('ringcentral')
    if (!message || !status) return
    if (status === 'connected') toast.success(message)
    else toast.error(message)
  }, [searchParams])

  async function sendTestEmail() {
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/integrations/resend-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to send test email.')
      const message = data.id ? `Test email sent. Provider id: ${data.id}` : 'Test email sent.'
      setTestResult(message)
      toast.success(message)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send test email.'
      setTestResult(message)
      toast.error(message)
    } finally {
      setTestLoading(false)
    }
  }

  async function disconnectRingCentral() {
    setDisconnectingRingCentral(true)
    try {
      const res = await fetch('/api/ringcentral/oauth/disconnect', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to disconnect RingCentral.')
      toast.success('RingCentral disconnected.')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to disconnect RingCentral.')
    } finally {
      setDisconnectingRingCentral(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        <Loader2 className="mx-auto mb-3 animate-spin text-kratos" size={22} />
        Loading integrations...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-800">{error}</p>
        <button onClick={load} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  if (!diagnostics) return null

  const ringcentralReady =
    diagnostics.ringcentralUser.connected &&
    diagnostics.ringcentral.fromNumber.callCapable &&
    Boolean(diagnostics.ringcentralUser.call_from_number)
  const ringcentralStatus = ringcentralReady ? 'ok' : diagnostics.ringcentralUser.setupRequired ? 'not_configured' : 'warning'
  const ringcentralStatusLabel = ringcentralReady ? 'Ready' : diagnostics.ringcentralUser.connected ? 'Review' : 'Needs setup'
  const ringcentralAction = diagnostics.ringcentralUser.connected ? (
    <button
      type="button"
      onClick={disconnectRingCentral}
      disabled={disconnectingRingCentral}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {disconnectingRingCentral ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
      Disconnect
    </button>
  ) : (
    <a href="/api/ringcentral/oauth/start" className="inline-flex items-center gap-2 rounded-lg bg-kratos px-3 py-2 text-sm font-semibold text-slate-950">
      Connect
      <ExternalLink size={14} />
    </a>
  )

  const twilioReady = diagnostics.sms?.provider === 'twilio' && diagnostics.sms?.canSend
  const twilioStatus = twilioReady ? 'ok' : diagnostics.sms?.provider === 'twilio' ? 'not_configured' : 'warning'
  const smsProviderLabel = diagnostics.sms?.provider === 'twilio' ? 'Twilio'
    : diagnostics.sms?.provider === 'ringcentral' ? 'RingCentral'
    : diagnostics.sms?.provider ?? 'Not set'
  const ev = diagnostics.sms?.envVars

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Google Maps ─────────────────────────────────────────── */}
      {diagnostics.googleMaps && (
        <IntegrationCard
          icon={<MapPin size={19} />}
          title="Google Maps"
          description="Address autocomplete and server-side travel time estimation for quotes."
          status={diagnostics.googleMaps.status}
          statusLabel={diagnostics.googleMaps.configured ? 'Configured' : 'Not configured'}
        >
          <div className="space-y-3">
            {!diagnostics.googleMaps.configured && (
              <SetupNotice>
                {diagnostics.googleMaps.message}
                {' Add '}
                <span className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span>
                {' in Vercel to enable address autocomplete and travel time estimates on quotes.'}
              </SetupNotice>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Status" value={
                <StatusBadge status={diagnostics.googleMaps.configured} label={diagnostics.googleMaps.configured ? 'Configured' : 'Missing'} />
              } />
              <Field label="Public key (autocomplete)" value={
                <StatusBadge status={diagnostics.googleMaps.hasPublicKey} label={diagnostics.googleMaps.hasPublicKey ? 'Present' : 'Missing'} />
              } />
              <Field label="Server key (travel time)" value={
                <StatusBadge
                  status={diagnostics.googleMaps.hasServerKey || diagnostics.googleMaps.hasPublicKey}
                  label={diagnostics.googleMaps.hasServerKey ? 'Dedicated key' : diagnostics.googleMaps.hasPublicKey ? 'Using public key' : 'Missing'}
                />
              } />
            </div>
            <p className="text-xs text-slate-500">{diagnostics.googleMaps.message}</p>
          </div>
        </IntegrationCard>
      )}

      {/* ── Twilio SMS ─────────────────────────────────────────── */}
      {diagnostics.sms && (
        <IntegrationCard
          icon={<MessageSquare size={19} />}
          title="Twilio SMS"
          description="Outbound SMS for estimates, follow-ups, and customer communication. Twilio is the SMS provider — RingCentral is for calling only."
          status={twilioStatus}
          statusLabel={twilioReady ? 'Ready' : 'Needs setup'}
        >
          <div className="space-y-4">
            {!twilioReady && (
              <SetupNotice>
                {diagnostics.sms.reason ?? 'Twilio SMS is not configured.'}
                {diagnostics.sms.recommendation && (
                  <span> {diagnostics.sms.recommendation}</span>
                )}
              </SetupNotice>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="SMS Provider" value={<span className="font-semibold">{smsProviderLabel}</span>} />
              <Field
                label="SMS_PROVIDER env var"
                value={ev?.SMS_PROVIDER?.present ? (ev.SMS_PROVIDER.value ?? 'set') : 'Not set — Twilio auto-detected when vars present'}
              />
              <Field
                label="From number"
                value={
                  ev?.TWILIO_FROM_NUMBER?.present
                    ? (ev.TWILIO_FROM_NUMBER.masked ?? 'set')
                    : <span className="text-red-600">Missing</span>
                }
              />
              <Field label="Delivery" value={
                <StatusBadge
                  status={diagnostics.sms.canSend ? 'ok' : 'not_configured'}
                  label={diagnostics.sms.canSend ? 'Active' : 'Not active'}
                />
              } />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Account SID</p>
                <div className="mt-2">
                  <StatusBadge
                    status={ev?.TWILIO_ACCOUNT_SID?.present ?? false}
                    label={ev?.TWILIO_ACCOUNT_SID?.present ? 'Present' : 'Missing'}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Auth Token</p>
                <div className="mt-2">
                  <StatusBadge
                    status={ev?.TWILIO_AUTH_TOKEN?.present ?? false}
                    label={ev?.TWILIO_AUTH_TOKEN?.present ? 'Present' : 'Missing'}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">From Number</p>
                <div className="mt-2">
                  <StatusBadge
                    status={ev?.TWILIO_FROM_NUMBER?.present ?? false}
                    label={ev?.TWILIO_FROM_NUMBER?.present ? `${ev.TWILIO_FROM_NUMBER.masked}` : 'Missing'}
                  />
                </div>
              </div>
            </div>
          </div>
        </IntegrationCard>
      )}

      <IntegrationCard
        icon={<PhoneCall size={19} />}
        title="RingCentral"
        description="Click-to-call only. Connect each CRM user to their RingCentral account for outbound calling. SMS is handled by Twilio."
        status={ringcentralStatus}
        statusLabel={ringcentralStatusLabel}
        action={ringcentralAction}
      >
        <div className="space-y-4">
          {diagnostics.ringcentralUser.setupRequired && (
            <SetupNotice>
              RingCentral connection storage is not installed yet. Run the RingCentral setup SQL in Supabase, then refresh this page.
            </SetupNotice>
          )}

          {!diagnostics.ringcentralUser.setupRequired && !diagnostics.ringcentralUser.connected && (
            <SetupNotice>
              Before connecting, add the OAuth callback URL below to the RingCentral Developer app. The current RingCentral error means this URL is not registered.
            </SetupNotice>
          )}

          {diagnostics.ringcentral.smsFromNumber && !diagnostics.ringcentral.smsFromNumber.smsCapable && (
            <SetupNotice>
              The current SMS number is not SMS-capable for this RingCentral extension. Pick one of the extension numbers with SmsSender enabled or add SMS capability in RingCentral.
            </SetupNotice>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="User connection" value={diagnostics.ringcentralUser.connected ? 'Connected' : 'Not connected'} />
            <Field label="Extension" value={diagnostics.ringcentralUser.extension_number ?? diagnostics.ringcentral.authenticatedExtension?.extensionNumber ?? 'Unavailable'} />
            <Field label="Call from" value={diagnostics.ringcentralUser.call_from_number ?? diagnostics.ringcentral.fromNumber.value ?? 'Unavailable'} />
            <Field label="SMS from" value={diagnostics.ringcentralUser.sms_from_number ?? diagnostics.ringcentral.smsFromNumber?.value ?? 'Unavailable'} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">OAuth Callback URL</p>
            <p className="mt-2 break-all font-mono text-sm text-slate-800">{diagnostics.ringcentralUser.redirectUri}</p>
            <p className="mt-2 text-sm text-slate-500">
              Add this exact URL in RingCentral Developer Console under the app&apos;s OAuth redirect/callback URLs.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">OAuth/JWT Check</p>
              <div className="mt-2"><StatusBadge status={diagnostics.ringcentral.authStatus} label={diagnostics.ringcentral.authStatus === 'ok' ? 'Verified' : 'Issue'} /></div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Calling</p>
              <div className="mt-2"><StatusBadge status={diagnostics.ringcentral.fromNumber.callCapable} label={diagnostics.ringcentral.fromNumber.callCapable ? 'Available' : 'Unavailable'} /></div>
            </div>
          </div>
        </div>
      </IntegrationCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <IntegrationCard
          icon={<Mail size={19} />}
          title="Email"
          description="Outbound email for estimates, notifications, and customer communication."
          status={diagnostics.resend.status}
          statusLabel={diagnostics.resend.status === 'ok' ? 'Ready' : 'Needs setup'}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="From" value={diagnostics.resend.fromDefault ?? 'Unavailable'} />
            <Field label="Reply-to" value={diagnostics.resend.replyToDefault ?? 'Unavailable'} />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Test recipient
              <input
                value={testEmail}
                onChange={event => setTestEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-kratos"
              />
            </label>
            <button onClick={sendTestEmail} disabled={testLoading || !testEmail.trim()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-kratos px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send test email
            </button>
            {testResult && <p className="mt-3 text-sm text-slate-600">{testResult}</p>}
          </div>
        </IntegrationCard>

        <IntegrationCard
          icon={<CreditCard size={19} />}
          title="Payments"
          description="Stripe payment collection and payment status syncing."
          status={diagnostics.stripe.status}
          statusLabel={diagnostics.stripe.status === 'ok' ? 'Ready' : 'Needs setup'}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Mode" value={diagnostics.stripe.mode ?? 'Unknown'} />
            <Field label="Status" value={diagnostics.stripe.message} />
          </div>
        </IntegrationCard>
      </div>
    </div>
  )
}
