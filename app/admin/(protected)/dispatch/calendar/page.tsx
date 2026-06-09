import { DispatchCalendarPage } from '@/components/admin/dispatch/DispatchCalendarPage'
import { fetchDispatchCalendarEvents } from '@/lib/dispatch/calendar'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: { year?: string; month?: string }
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const now = new Date()
  const year  = searchParams.year  ? parseInt(searchParams.year, 10)  : now.getFullYear()
  const month = searchParams.month != null ? parseInt(searchParams.month, 10) : now.getMonth()

  // Fetch a window covering the displayed month plus its leading/trailing days
  const rangeStart = new Date(year, month - 1, 1)
  const rangeEnd   = new Date(year, month + 2, 0)
  const events     = await fetchDispatchCalendarEvents(rangeStart, rangeEnd)

  return <DispatchCalendarPage year={year} month={month} events={events} />
}
