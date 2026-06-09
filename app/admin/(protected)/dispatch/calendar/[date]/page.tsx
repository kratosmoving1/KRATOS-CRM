import { notFound } from 'next/navigation'
import { DispatchDayDetail } from '@/components/admin/dispatch/DispatchDayDetail'
import { fetchDayDetailData } from '@/lib/dispatch/calendar'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { date: string }
}

export default async function DayDetailPage({ params }: PageProps) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.date)
  if (!dateMatch) notFound()

  const [, y, m, d] = dateMatch
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  if (isNaN(date.getTime())) notFound()

  const initialData = await fetchDayDetailData(params.date)

  return <DispatchDayDetail date={date} initialData={initialData} />
}
