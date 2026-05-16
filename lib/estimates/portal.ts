import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createPortalToken() {
  return randomBytes(32).toString('base64url')
}

export async function getOrCreateEstimatePortalLink({
  supabase,
  opportunityId,
  quoteId = null,
  createdBy,
}: {
  supabase: SupabaseClient
  opportunityId: string
  quoteId?: string | null
  createdBy: string
}) {
  const { data: existing } = await supabase
    .from('estimate_portal_links')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .is('expires_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('estimate_portal_links')
      .insert({
        opportunity_id: opportunityId,
        quote_id: quoteId,
        token: createPortalToken(),
        expires_at: null,
        created_by: createdBy,
      })
      .select()
      .single()

    if (!error && data) return data
    if (error?.code !== '23505') throw error
  }

  throw new Error('Unable to create estimate portal link.')
}

export function portalEstimateUrl(origin: string, token: string, preview = false) {
  const url = new URL(`/portal/estimate/${token}`, origin)
  if (preview) url.searchParams.set('preview', '1')
  return url.toString()
}
