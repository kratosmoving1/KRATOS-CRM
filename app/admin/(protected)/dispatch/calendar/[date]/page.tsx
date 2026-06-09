import { notFound } from 'next/navigation'
import { DispatchDayDetail } from '@/components/admin/dispatch/DispatchDayDetail'
import { fetchDispatchCalendarEvents } from '@/lib/dispatch/calendar'

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

  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end   = new Date(date); end.setHours(23, 59, 59, 999)

  const events = await fetchDispatchCalendarEvents(start, end)

  return <DispatchDayDetail date={date} events={events} />
}
