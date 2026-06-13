'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Clock, Phone, Truck, Users, Loader2, Navigation, FileText, PenLine, CheckCircle2, XCircle } from 'lucide-react'

interface JobDocument {
  id: string
  name: string
  category: string
  status: string
  signed_at: string | null
  sent_to: string | null
  signed_by: string | null
}

interface CrewPerson { id: string; name: string; profile_picture_url: string | null }
interface MyAcceptance { status: string; responded_at: string | null }
interface Assignment {
  id: string; scheduled_date: string; start_time: string; duration_hours: number; notes: string | null
  my_acceptance?: MyAcceptance | null
  crew: {
    id: string; name: string; notes: string | null
    truck: { id: string; name: string; category: string } | null
    driver: CrewPerson | null; dispatcher: CrewPerson | null
    helpers: Array<{ person: CrewPerson }>
  } | null
  opportunity: {
    id: string; opportunity_number: string; status: string; service_type: string
    service_date: string | null; move_size: string | null
    origin_address_line1: string | null; origin_city: string | null; origin_province: string | null; origin_postal_code?: string | null
    dest_address_line1: string | null; dest_city: string | null; dest_province: string | null; dest_postal_code?: string | null
    customer: { id: string; full_name: string; phone: string | null } | null
  } | null
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function buildMapsUrl(address: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`
}

export default function CrewJobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [assignment, setAssignment]   = useState<Assignment | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [documents, setDocuments]     = useState<JobDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [acceptance, setAcceptance]   = useState<MyAcceptance | null>(null)
  const [responding, setResponding]   = useState(false)

  useEffect(() => {
    fetch('/api/crew/jobs')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        const found = (d.assignments ?? []).find((a: Assignment) => a.id === params.id)
        if (!found) { setError('Job not found'); return }
        setAssignment(found)
        setAcceptance(found.my_acceptance ?? null)
        // Load documents after assignment is found
        setDocsLoading(true)
        fetch(`/api/crew/jobs/${params.id}/documents`)
          .then(r => r.json())
          .then(dd => { setDocuments(dd.documents ?? []) })
          .catch(() => {})
          .finally(() => setDocsLoading(false))
      })
      .catch(() => setError('Failed to load job'))
      .finally(() => setLoading(false))
  }, [params.id])

  async function respond(action: 'accept' | 'decline') {
    setResponding(true)
    try {
      const res = await fetch(`/api/crew/jobs/${params.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Failed to respond'); return }
      setAcceptance({ status: d.status, responded_at: d.responded_at })
    } catch {
      setError('Network error — please try again')
    } finally {
      setResponding(false)
    }
  }

  const opp = assignment?.opportunity
  const crew = assignment?.crew
  const origin = [opp?.origin_address_line1, opp?.origin_city, opp?.origin_province].filter(Boolean).join(', ')
  const dest = [opp?.dest_address_line1, opp?.dest_city, opp?.dest_province].filter(Boolean).join(', ')
  const crewMembers = [
    crew?.driver ? { ...crew.driver, role: 'Driver' } : null,
    crew?.dispatcher ? { ...crew.dispatcher, role: 'Dispatcher' } : null,
    ...(crew?.helpers?.map(h => ({ ...h.person, role: 'Helper' })) ?? []),
  ].filter(Boolean) as Array<CrewPerson & { role: string }>

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">
            {opp?.customer?.full_name ?? 'Job Detail'}
          </p>
          {opp?.opportunity_number && (
            <p className="text-xs text-slate-400">#{opp.opportunity_number}</p>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-8">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#ffad33]" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-4 text-sm text-red-300 text-center">
            {error}
          </div>
        )}

        {assignment && (
          <>
            {/* Time + Date */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Schedule</p>
              <div className="flex items-center gap-2 text-white">
                <Clock size={16} className="text-[#ffad33]" />
                <span className="font-semibold">{formatTime(assignment.start_time)}</span>
                <span className="text-slate-400 text-sm">·</span>
                <span className="text-slate-300 text-sm">{formatDate(assignment.scheduled_date)}</span>
              </div>
              {assignment.duration_hours > 0 && (
                <p className="text-xs text-slate-500 mt-1 ml-6">Est. {assignment.duration_hours}h</p>
              )}
            </div>

            {/* Accept / Decline — only once the dispatcher has published this job */}
            {acceptance && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                {acceptance.status === 'accepted' ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} className="text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">You accepted this job</p>
                      <p className="text-xs text-slate-500">Tap decline below if your availability changes.</p>
                    </div>
                  </div>
                ) : acceptance.status === 'declined' ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                      <XCircle size={18} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">You declined this job</p>
                      <p className="text-xs text-slate-500">Changed your mind? Tap accept below.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-white mb-3">Can you take this job?</p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => respond('accept')}
                    disabled={responding || acceptance.status === 'accepted'}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white active:bg-green-700 disabled:opacity-40 transition-colors"
                  >
                    {responding ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Accept
                  </button>
                  <button
                    onClick={() => respond('decline')}
                    disabled={responding || acceptance.status === 'declined'}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 py-2.5 text-sm font-bold text-slate-200 active:bg-slate-700 disabled:opacity-40 transition-colors"
                  >
                    <XCircle size={14} /> Decline
                  </button>
                </div>
              </div>
            )}

            {/* Addresses */}
            {(origin || dest) && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Locations</p>
                {origin && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <MapPin size={11} className="text-green-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Pick-up</p>
                        <p className="text-sm text-white">{origin}</p>
                      </div>
                    </div>
                    <a
                      href={buildMapsUrl(origin)}
                      className="shrink-0 flex items-center gap-1 text-[#ffad33] text-xs font-medium"
                    >
                      <Navigation size={12} /> Map
                    </a>
                  </div>
                )}
                {dest && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                        <MapPin size={11} className="text-red-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Drop-off</p>
                        <p className="text-sm text-white">{dest}</p>
                      </div>
                    </div>
                    <a
                      href={buildMapsUrl(dest)}
                      className="shrink-0 flex items-center gap-1 text-[#ffad33] text-xs font-medium"
                    >
                      <Navigation size={12} /> Map
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Customer */}
            {opp?.customer && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Customer</p>
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium">{opp.customer.full_name}</p>
                  {opp.customer.phone && (
                    <a
                      href={`tel:${opp.customer.phone}`}
                      className="flex items-center gap-1.5 rounded-lg bg-[#ffad33] px-3 py-1.5 text-xs font-bold text-slate-950"
                    >
                      <Phone size={12} /> Call
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Crew */}
            {crewMembers.length > 0 && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Your Crew</p>
                <div className="space-y-2">
                  {crewMembers.map((m, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 overflow-hidden">
                        {m.profile_picture_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.profile_picture_url} alt={m.name} className="w-full h-full object-cover" />
                          : m.name.charAt(0).toUpperCase()
                        }
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Truck */}
            {crew?.truck && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Truck</p>
                <div className="flex items-center gap-2 text-white">
                  <Truck size={16} className="text-slate-400" />
                  <span className="font-medium">{crew.truck.name}</span>
                  <span className="text-slate-500 text-xs">{crew.truck.category}</span>
                </div>
              </div>
            )}

            {/* Job notes */}
            {(assignment.notes || crew?.notes) && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Notes</p>
                {crew?.notes && <p className="text-sm text-slate-300">{crew.notes}</p>}
                {assignment.notes && <p className="text-sm text-slate-300 mt-1">{assignment.notes}</p>}
              </div>
            )}

            {/* Documents / Contract */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Documents</p>
              {docsLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </div>
              ) : documents.length === 0 ? (
                <p className="text-xs text-slate-600">No documents generated for this job.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => {
                    const isSigned  = ['signed', 'completed'].includes(doc.status)
                    const isContract = doc.category === 'job_contract'
                    const needsSig  = isContract && !isSigned && ['sent', 'viewed', 'generated'].includes(doc.status)
                    return (
                      <div key={doc.id} className="rounded-xl bg-slate-800 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <FileText size={14} className={isSigned ? 'text-green-400 mt-0.5 shrink-0' : 'text-slate-500 mt-0.5 shrink-0'} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                              {isSigned && doc.signed_by && (
                                <p className="text-[11px] text-green-400 flex items-center gap-1 mt-0.5">
                                  <CheckCircle2 size={10} /> Signed by {doc.signed_by}
                                </p>
                              )}
                              {isSigned && doc.signed_at && !doc.signed_by && (
                                <p className="text-[11px] text-green-400 flex items-center gap-1 mt-0.5">
                                  <CheckCircle2 size={10} /> Signed
                                </p>
                              )}
                              {!isSigned && doc.status === 'sent' && doc.sent_to && (
                                <p className="text-[11px] text-amber-400 mt-0.5">Sent · awaiting signature</p>
                              )}
                            </div>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            isSigned ? 'bg-green-900/50 text-green-400'
                            : doc.status === 'sent' || doc.status === 'viewed' ? 'bg-amber-900/50 text-amber-400'
                            : 'bg-slate-700 text-slate-400'
                          }`}>
                            {isSigned ? 'Signed' : doc.status === 'viewed' ? 'Viewed' : doc.status === 'sent' ? 'Sent' : doc.status}
                          </span>
                        </div>
                        {needsSig && (
                          <a
                            href={`/portal/documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ffad33] px-3 py-2 text-xs font-bold text-slate-950"
                          >
                            <PenLine size={12} /> Customer Sign Now
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Crew count badge */}
            <div className="flex items-center gap-2 text-xs text-slate-600 pb-2">
              <Users size={12} />
              {crewMembers.length} crew members assigned
              {opp?.move_size && <span>· {opp.move_size.replace(/_/g, ' ')}</span>}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
