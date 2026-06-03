'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  customerId: string
  customerName: string
  onClose: () => void
}

interface Counts {
  quotes: number
  communications: number
}

export default function DeleteCustomerModal({ customerId, customerName, onClose }: Props) {
  const router = useRouter()
  const [counts, setCounts] = useState<Counts | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/customers/${customerId}/related-counts`)
      .then(r => r.json())
      .then(setCounts)
      .catch(() => setCounts({ quotes: 0, communications: 0 }))
  }, [customerId])

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to delete customer')
        return
      }
      router.push('/admin/customers')
    } catch {
      setError('Network error — please try again')
    } finally {
      setDeleting(false)
    }
  }

  const hasRelated = counts && (counts.quotes > 0 || counts.communications > 0)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <AlertTriangle size={16} className="text-red-500" />
            Delete Customer
          </h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete <strong>{customerName}</strong>?
          </p>

          {hasRelated && (
            <div className="text-sm text-slate-700">
              <p className="mb-1.5">This will also remove:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                {(counts?.quotes ?? 0) > 0 && (
                  <li>{counts!.quotes} {counts!.quotes === 1 ? 'quote' : 'quotes'}</li>
                )}
                {(counts?.communications ?? 0) > 0 && (
                  <li>{counts!.communications} communication{counts!.communications === 1 ? '' : 's'}</li>
                )}
              </ul>
            </div>
          )}

          {counts === null && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={13} className="animate-spin" />
              Loading related records…
            </div>
          )}

          <p className="text-xs text-slate-400">
            Records are soft-deleted and can be restored via direct database access if needed.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || counts === null}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting && <Loader2 size={13} className="animate-spin" />}
            {deleting ? 'Deleting…' : 'Delete Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}
