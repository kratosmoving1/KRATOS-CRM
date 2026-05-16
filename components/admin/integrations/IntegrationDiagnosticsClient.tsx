'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Send, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type EnvItem = {
  present: boolean
  value?: string
  note?: string
}

type Diagnostics = {
  environment: Record<string, EnvItem>
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
    authenticatedExtension: null | {
      id?: string
      extensionNumber?: string
      name?: string
      email?: string
    }
    scopes: string[]
    phoneNumbers: Array<{
      phoneNumber: string
      type: string
      features: string[]
    }>
    fromNumber: {
      value: string
      ownedByAuthenticatedExtension: boolean
      smsCapable: boolean
      callCapable: boolean
    }
  }
  stripe: {
    configured: boolean
    status: string
    mode?: string
    message: string
  }
  portal: {
    appUrlPresent: boolean
    appUrl: string | null
    portalBaseUrl: string | null
    estimatePortalLinksTable: { available: boolean; message: string }
    estimateSignaturesTable: { available: boolean; message: string }
  }
  generatedAt?: string
}

const ENV_ORDER = [
  'NEXT_PUBLIC_APP_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'EMAIL_FROM_DEFAULT',
  'EMAIL_REPLY_TO_DEFAULT',
  'RINGCENTRAL_CLIENT_ID',
  'RINGCENTRAL_CLIENT_SECRET',
  'RINGCENTRAL_JWT',
  'RINGCENTRAL_SERVER_URL',
  'RINGCENTRAL_FROM_NUMBER',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
]

function statusTone(status: string | boolean) {
  if (status === true || status === 'ok' || status === 'present') return 'emerald'
  if (status === 'not_configured' || status === 'error' || status === false || status === 'missing') return 'red'
  return 'amber'
}

function StatusBadge({ status, label }: { status: string | boolean; label?: string }) {
  const tone = statusTone(status)
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
      {label ?? (typeof status === 'boolean' ? (status ? 'Present' : 'Missing') : status.replace(/_/g, ' '))}
    </span>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DetailRow({ label, value, status }: { label: string; value: ReactNode; status?: string | boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="flex items-center gap-2 text-right text-sm text-slate-900">
        {status !== undefined && <StatusBadge status={status} />}
        {value}
      </span>
    </div>
  )
}

export default function IntegrationDiagnosticsClient() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/integrations/diagnostics', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to load diagnostics.')
      setDiagnostics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load diagnostics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        <Loader2 className="mx-auto mb-3 animate-spin text-kratos" size={22} />
        Loading integration diagnostics...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-800">{error}</p>
        <button onClick={load} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  if (!diagnostics) return null

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <Card title="Environment Variables">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                <th className="py-2 pr-4">Variable</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Safe Value / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ENV_ORDER.map(name => {
                const item = diagnostics.environment[name]
                return (
                  <tr key={name}>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700">{name}</td>
                    <td className="py-3 pr-4"><StatusBadge status={item?.present ?? false} /></td>
                    <td className="py-3 text-sm text-slate-600">{item?.value ?? item?.note ?? (item?.present ? 'Set, hidden for security' : 'Missing')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="RingCentral">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{diagnostics.ringcentral.message}</div>
          <div className="mt-3 divide-y divide-slate-100">
            <DetailRow label="Auth status" status={diagnostics.ringcentral.authStatus} value={diagnostics.ringcentral.authStatus.replace(/_/g, ' ')} />
            <DetailRow label="Server URL" value={diagnostics.ringcentral.serverUrl} />
            <DetailRow label="Authenticated extension" value={diagnostics.ringcentral.authenticatedExtension?.name ?? 'Unavailable'} />
            <DetailRow label="Extension number" value={diagnostics.ringcentral.authenticatedExtension?.extensionNumber ?? 'Unavailable'} />
            <DetailRow label="From number" value={diagnostics.ringcentral.fromNumber.value || 'Missing'} />
            <DetailRow label="Owned by extension" status={diagnostics.ringcentral.fromNumber.ownedByAuthenticatedExtension} value={diagnostics.ringcentral.fromNumber.ownedByAuthenticatedExtension ? 'Yes' : 'No'} />
            <DetailRow label="SMS capable" status={diagnostics.ringcentral.fromNumber.smsCapable} value={diagnostics.ringcentral.fromNumber.smsCapable ? 'Yes' : 'No'} />
            <DetailRow label="RingOut likely" status={diagnostics.ringcentral.fromNumber.callCapable} value={diagnostics.ringcentral.fromNumber.callCapable ? 'Yes' : 'No'} />
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Scopes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {diagnostics.ringcentral.scopes.length ? diagnostics.ringcentral.scopes.map(scope => (
                <span key={scope} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{scope}</span>
              )) : (
                <span className="text-sm text-slate-500">Unable to read token scopes from SDK/API response. Verify scopes in RingCentral Developer Console.</span>
              )}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Extension Phone Numbers</p>
            <div className="mt-2 space-y-2">
              {diagnostics.ringcentral.phoneNumbers.length ? diagnostics.ringcentral.phoneNumbers.map(number => (
                <div key={`${number.phoneNumber}-${number.type}`} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{number.phoneNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">{number.type || 'Unknown type'} · {number.features.length ? number.features.join(', ') : 'No features returned'}</p>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No phone numbers returned.</p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Resend Email">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{diagnostics.resend.message}</div>
          <div className="mt-3 divide-y divide-slate-100">
            <DetailRow label="Status" status={diagnostics.resend.status} value={diagnostics.resend.status.replace(/_/g, ' ')} />
            <DetailRow label="From default" value={diagnostics.resend.fromDefault ?? 'Missing'} />
            <DetailRow label="Reply-To default" value={diagnostics.resend.replyToDefault ?? 'Missing'} />
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
              Test recipient email
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
        </Card>

        <Card title="Stripe">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{diagnostics.stripe.message}</div>
          <div className="mt-3 divide-y divide-slate-100">
            <DetailRow label="Status" status={diagnostics.stripe.status} value={diagnostics.stripe.status.replace(/_/g, ' ')} />
            <DetailRow label="Mode" value={diagnostics.stripe.mode ?? 'Unknown'} />
          </div>
        </Card>

        <Card title="Customer Portal">
          <div className="divide-y divide-slate-100">
            <DetailRow label="App URL" status={diagnostics.portal.appUrlPresent} value={diagnostics.portal.appUrl ?? 'Missing'} />
            <DetailRow label="Portal base URL" value={diagnostics.portal.portalBaseUrl ?? 'Unavailable'} />
            <DetailRow label="estimate_portal_links" status={diagnostics.portal.estimatePortalLinksTable.available} value={diagnostics.portal.estimatePortalLinksTable.message} />
            <DetailRow label="estimate_signatures" status={diagnostics.portal.estimateSignaturesTable.available} value={diagnostics.portal.estimateSignaturesTable.message} />
          </div>
        </Card>
      </div>

      {diagnostics.generatedAt && (
        <p className="text-right text-xs text-slate-400">Generated {new Date(diagnostics.generatedAt).toLocaleString()}</p>
      )}
    </div>
  )
}
