import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/permissions'
import { requireActiveProfile } from '@/lib/auth/server'
import { getOrCreateEstimatePortalLink, portalEstimateUrl } from '@/lib/estimates/portal'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await requireActiveProfile(supabase)
  if (auth.response) return auth.response

  const { user, role } = auth.context
  const normalizedRole = normalizeRole(role)
  if (!['owner', 'admin', 'manager', 'sales'].includes(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const opportunityId = typeof body.opportunityId === 'string' ? body.opportunityId : null
  const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null
  const preview = Boolean(body.preview)

  if (!opportunityId) return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 })

  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('id, sales_agent_id')
    .eq('id', opportunityId)
    .eq('is_deleted', false)
    .single()

  if (error || !opportunity) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  if (normalizedRole === 'sales' && opportunity.sales_agent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const link = await getOrCreateEstimatePortalLink({ supabase, opportunityId, quoteId, createdBy: user.id })
  return NextResponse.json({
    token: link.token,
    url: portalEstimateUrl(req.nextUrl.origin, link.token, preview),
  })
}
