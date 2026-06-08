import { PeopleListView } from '@/components/admin/workforce/PeopleListView'
import { fetchBoardState } from '@/lib/workforce/server'

export const dynamic = 'force-dynamic'

export default async function WorkforcePage() {
  const initial = await fetchBoardState()
  return <PeopleListView initial={initial} />
}
