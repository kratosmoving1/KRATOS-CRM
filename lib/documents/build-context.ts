import { createAdminClient } from '@/lib/supabase/admin'
import type { RenderContext } from './render'
import type { OpportunityCharge } from '@/components/admin/charges/types'

/**
 * Builds a RenderContext for document rendering from live DB data.
 * Uses the admin client so it works from both authenticated API routes and public portal pages.
 * All column names verified against SCHEMA.md.
 */
export async function buildRenderContext(opportunityId: string): Promise<RenderContext> {
  const supabase = createAdminClient()

  // Opportunity with joins — column names match SCHEMA.md exactly
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select(`
      id,
      opportunity_number,
      service_type,
      service_date,
      move_size,
      deposit_amount,
      origin_address_line1,
      origin_address_line2,
      origin_city,
      origin_province,
      origin_postal_code,
      origin_dwelling_type,
      dest_address_line1,
      dest_address_line2,
      dest_city,
      dest_province,
      dest_postal_code,
      dest_dwelling_type,
      customer:customers!customer_id(full_name, email, phone),
      agent:profiles!sales_agent_id(full_name, email),
      lead_source:lead_sources!lead_source_id(name)
    `)
    .eq('id', opportunityId)
    .neq('is_deleted', true)
    .maybeSingle()

  if (oppErr || !opp) throw new Error(`Opportunity ${opportunityId} not found: ${oppErr?.message ?? 'no data'}`)

  // Non-deleted charges, sorted by sort_order
  const { data: rawCharges } = await supabase
    .from('opportunity_charges')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .neq('is_deleted', true)
    .order('sort_order', { ascending: true })

  const charges = (rawCharges ?? []) as OpportunityCharge[]

  // Supabase returns FK joins as single object or array depending on cardinality
  const customer = Array.isArray(opp.customer) ? opp.customer[0] : opp.customer
  const agent = Array.isArray(opp.agent) ? opp.agent[0] : opp.agent
  const leadSource = Array.isArray(opp.lead_source) ? opp.lead_source[0] : opp.lead_source

  return {
    opportunity_id: opp.id,
    opportunity_number: opp.opportunity_number ?? '',
    service_date: opp.service_date,
    move_size: opp.move_size,
    service_type: opp.service_type,
    deposit_amount: opp.deposit_amount ?? null,
    customer: customer
      ? { full_name: customer.full_name, email: customer.email ?? null, phone: customer.phone ?? null }
      : null,
    agent: agent ? { full_name: agent.full_name, email: agent.email } : null,
    lead_source: leadSource ? { name: leadSource.name } : null,
    origin_address_line1: opp.origin_address_line1,
    origin_address_line2: opp.origin_address_line2,
    origin_city: opp.origin_city,
    origin_province: opp.origin_province,
    origin_postal_code: opp.origin_postal_code,
    origin_dwelling_type: opp.origin_dwelling_type,
    dest_address_line1: opp.dest_address_line1,
    dest_address_line2: opp.dest_address_line2,
    dest_city: opp.dest_city,
    dest_province: opp.dest_province,
    dest_postal_code: opp.dest_postal_code,
    dest_dwelling_type: opp.dest_dwelling_type,
    charges,
  }
}
