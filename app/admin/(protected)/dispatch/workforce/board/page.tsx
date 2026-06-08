import { WorkforceBoard } from '@/components/admin/workforce/WorkforceBoard'
import { fetchBoardState } from '@/lib/workforce/server'

export const dynamic = 'force-dynamic'

export default async function WorkforceBoardPage() {
  const initial = await fetchBoardState()
  return <WorkforceBoard initial={initial} />
}
