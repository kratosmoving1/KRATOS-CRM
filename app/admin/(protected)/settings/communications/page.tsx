'use client'

import { Mail, CheckCircle2 } from 'lucide-react'

interface EmailTrigger {
  name: string
  trigger: string
  description: string
  recipient: string
  status: 'active' | 'inactive'
}

const EMAIL_TRIGGERS: EmailTrigger[] = [
  {
    name: 'Estimate Ready',
    trigger: 'Agent clicks "Send Estimate" on the Quote tab',
    description: 'Sends the customer a branded email with their move details, a summary of our credentials, and a button to view their online estimate portal.',
    recipient: 'Customer (email on file)',
    status: 'active',
  },
  {
    name: 'Booking Confirmation',
    trigger: 'Customer accepts the estimate on the portal, OR agent clicks "Book" from the opportunity',
    description: 'Confirms the move is on the schedule. Includes move date, origin, destination, service type, and a link back to the estimate portal.',
    recipient: 'Customer (email on file)',
    status: 'active',
  },
  {
    name: 'Cancellation Notice',
    trigger: 'Agent clicks "Cancel" and enables the notification checkbox',
    description: 'Notifies the customer their booking has been cancelled. Includes an optional cancellation reason entered by the agent and a link to rebook via the portal.',
    recipient: 'Customer (email on file)',
    status: 'active',
  },
  {
    name: 'Reschedule Notice',
    trigger: 'Agent changes the service date on a booked or active opportunity',
    description: 'Informs the customer their move date has changed. Shows the old date (struck through) and the new confirmed date, along with all move details.',
    recipient: 'Customer (email on file)',
    status: 'active',
  },
]

export default function CommunicationsSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Client Communications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Automated emails sent to customers at key stages of the moving process.
          These fire automatically — no manual action needed once configured.
        </p>
      </div>

      <div className="space-y-3">
        {EMAIL_TRIGGERS.map((trigger) => (
          <div
            key={trigger.name}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kratos/10">
                  <Mail size={15} className="text-kratos" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-[15px]">{trigger.name}</p>
                    {trigger.status === 'active' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                        <CheckCircle2 size={10} />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[13px] text-slate-600 leading-relaxed">
                    {trigger.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Trigger</span>
                      <p className="text-[13px] text-slate-700">{trigger.trigger}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recipient</span>
                      <p className="text-[13px] text-slate-700">{trigger.recipient}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-[13px] text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Coming soon:</strong> Email template editing, per-trigger enable/disable toggles,
          CC addresses, and SMS notification options will be added here in a future update.
        </p>
      </div>
    </div>
  )
}
