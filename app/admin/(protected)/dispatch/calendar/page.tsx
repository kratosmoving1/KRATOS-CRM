import { DispatchCalendar } from '@/components/admin/dispatch/DispatchCalendar'
import { fetchDispatchCalendarEvents } from '@/lib/dispatch/calendar'
import './calendar.css'

export const dynamic = 'force-dynamic'

export default async function DispatchCalendarPage() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - 60)
  const end = new Date(now)
  end.setDate(now.getDate() + 90)

  const events = await fetchDispatchCalendarEvents(start, end)

  return <DispatchCalendar initialEvents={events} />
}
