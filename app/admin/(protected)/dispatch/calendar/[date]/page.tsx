import { notFound } from 'next/navigation'
import { DispatchDayDetail } from '@/components/admin/dispatch/DispatchDayDetail'
import { fetchDayDetailData } from '@/lib/dispatch/calendar'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { date: string }
}

export default async function DayDetailPage({ params }: PageProps) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) notFound()

  const initialData = await fetchDayDetailData(params.date)

  // Pass the date as a string — DispatchDayDetail parses it locally to avoid
  // the UTC→local timezone shift that happens when passing Date objects across
  // the server/client boundary in Next.js.
  return <DispatchDayDetail dateStr={params.date} initialData={initialData} />
}
