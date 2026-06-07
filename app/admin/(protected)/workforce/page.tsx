import { WorkforceBoard } from '@/components/admin/workforce/WorkforceBoard'
import { fetchBoardState } from '@/lib/workforce/server'

export const dynamic = 'force-dynamic'

export default async function WorkforcePage() {
  const initial = await fetchBoardState()

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workforce</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize your crews and movers. Drag cards between columns to reorganize.
          </p>
        </div>
      </div>

      <WorkforceBoard initial={initial} />
    </div>
  )
}
