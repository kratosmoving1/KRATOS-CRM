import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderDocument, buildDocumentNumber } from '@/lib/documents/render'
import type { RenderContext } from '@/lib/documents/render'
import type { OpportunityCharge } from '@/components/admin/charges/types'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Load opportunity with all related data
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select(`
      id, opportunity_number, service_type, service_date, move_size, deposit_amount,
      origin_address_line1, origin_address_line2, origin_city, origin_province, origin_postal_code, origin_dwelling_type,
      dest_address_line1, dest_address_line2, dest_city, dest_province, dest_postal_code, dest_dwelling_type,
      customer:customers(id, full_name, email, phone),
      agent:profiles!opportunities_sales_agent_id_fkey(id, full_name, email),
      lead_source:lead_sources(id, name)
    `)
    .eq('id', params.id)
    .neq('is_deleted', true)
    .maybeSingle()

  if (oppErr || !opp) {
    return NextResponse.json({ error: `Opportunity ${params.id} not found` }, { status: 404 })
  }

  // 2. Load non-deleted charges for this opportunity
  const { data: rawCharges } = await supabase
    .from('opportunity_charges')
    .select('*')
    .eq('opportunity_id', params.id)
    .neq('is_deleted', true)
    .order('sort_order', { ascending: true })

  const charges = (rawCharges ?? []) as OpportunityCharge[]

  // 3. Load all published document templates
  const { data: templates, error: tplErr } = await supabase
    .from('document_templates')
    .select('id, name, category, content_html')
    .eq('status', 'published')
    .neq('is_deleted', true)
    .order('category', { ascending: true })

  if (tplErr) {
    return NextResponse.json({ error: tplErr.message }, { status: 500 })
  }

  if (!templates || templates.length === 0) {
    return NextResponse.json(
      { error: 'No published templates found. Go to Settings → Documents to publish templates.' },
      { status: 422 },
    )
  }

  // 4. Build render context
  const customerData = Array.isArray(opp.customer) ? opp.customer[0] : opp.customer
  const agentData = Array.isArray(opp.agent) ? opp.agent[0] : opp.agent
  const leadSourceData = Array.isArray(opp.lead_source) ? opp.lead_source[0] : opp.lead_source

  const ctx: RenderContext = {
    opportunity_id: opp.id,
    opportunity_number: opp.opportunity_number ?? '',
    service_date: opp.service_date,
    move_size: opp.move_size,
    service_type: opp.service_type,
    deposit_amount: opp.deposit_amount ?? null,
    customer: customerData ? {
      full_name: customerData.full_name,
      email: customerData.email ?? null,
      phone: customerData.phone ?? null,
    } : null,
    agent: agentData ? {
      full_name: agentData.full_name,
      email: agentData.email,
    } : null,
    lead_source: leadSourceData ? { name: leadSourceData.name } : null,
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

  // 5. For each published template, render and upsert
  const now = new Date().toISOString()
  const upserted: string[] = []

  for (const template of templates) {
    const docNumber = buildDocumentNumber(opp.opportunity_number ?? '', template.category)
    const renderedHtml = renderDocument(template.content_html ?? '', ctx, docNumber)

    // Check if a document already exists for this opportunity + template
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('opportunity_id', params.id)
      .eq('template_id', template.id)
      .neq('is_deleted', true)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('documents')
        .update({
          rendered_html: renderedHtml,
          rendered_at: now,
          status: 'generated',
          name: template.name,
          category: template.category,
          document_number: docNumber,
        })
        .eq('id', existing.id)
      upserted.push(existing.id)
    } else {
      const { data: created } = await supabase
        .from('documents')
        .insert({
          opportunity_id: params.id,
          template_id: template.id,
          name: template.name,
          category: template.category,
          status: 'generated',
          rendered_html: renderedHtml,
          rendered_at: now,
          document_number: docNumber,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (created) upserted.push(created.id)
    }
  }

  // 6. Return the refreshed list
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('opportunity_id', params.id)
    .neq('is_deleted', true)
    .order('category', { ascending: true })

  return NextResponse.json({ generated: upserted.length, documents: docs ?? [] }, { status: 200 })
}
