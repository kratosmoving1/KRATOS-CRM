import { createClient } from '@/lib/supabase/server'

export interface DashboardData {
  movesThisMonth: number
  revenueThisMonth: number
  jobsToday: number
  avgProfitPerCustomer: number
  avgMoveValueThisMonth: number
  activity: {
    today: { leads: number; opportunities: number; booked: number; cancellations: number }
    week:  { leads: number; opportunities: number; booked: number; cancellations: number }
    month: { leads: number; opportunities: number; booked: number; cancellations: number }
  }
  openItems: {
    unassignedLeads: number
    newLeads: number
    bookedToday: number
    staleOpportunities: number
  }
  salesLeaders: Array<{
    agent_name: string
    moves: number
    revenue: number
  }>
  referralSources: Array<{
    source_name: string
    moves: number
    revenue: number
  }>
  monthlyRevenue: Array<{
    month: string
    revenue: number
  }>
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('get_dashboard_data')

  if (error) throw new Error(error.message)

  return data as DashboardData
}
