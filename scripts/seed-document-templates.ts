/**
 * Kratos CRM — Seed Document Templates
 *
 * Run with:  npx tsx scripts/seed-document-templates.ts
 *
 * Inserts 5 starter document templates if they don't already exist.
 * Safe to re-run — skips any template that already has the same name + category.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })
else dotenv.config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Template content ──────────────────────────────────────────────────────────

const mf = (token: string) =>
  `<span class="kratos-merge-field" data-merge-field="${token}">{{${token}}}</span>`

const ESTIMATE_HTML = `
<h1>Moving Services Estimate</h1>
<p><strong>Estimate Number:</strong> ${mf('document_number')}</p>
<p><strong>Date:</strong> ${mf('generated_date')}</p>

<h2>Customer</h2>
<p>${mf('customer_full_name')}<br>${mf('customer_phone')}<br>${mf('customer_email')}</p>

<h2>Move Details</h2>
<p>
  <strong>Move Date:</strong> ${mf('move_date')}<br>
  <strong>Move Size:</strong> ${mf('move_size')}<br>
  <strong>Service Type:</strong> ${mf('service_type')}
</p>
<p><strong>Origin:</strong> ${mf('origin_address')}</p>
<p><strong>Destination:</strong> ${mf('destination_address')}</p>

<h2>Package</h2>
<p>
  ${mf('package_name')}<br>
  ${mf('num_trucks')} truck(s), ${mf('num_crew')} movers<br>
  Hourly Rate: ${mf('hourly_rate')}
</p>

<h2>Charges</h2>
${mf('charges_table')}
<p>
  <strong>Subtotal:</strong> ${mf('subtotal')}<br>
  <strong>HST (13%):</strong> ${mf('hst')}<br>
  <strong>Estimated Total:</strong> ${mf('estimated_total')}<br>
  <strong>Deposit Required:</strong> ${mf('deposit_required')}
</p>

<hr>
<p><em>This estimate is valid for 30 days from the date generated. Final charges may vary based on actual time and materials used during the move.</em></p>
<p><strong>Kratos Moving — Done As Promised.</strong></p>
`.trim()

const CONTRACT_HTML = `
<h1>Moving Services Contract</h1>
<p><strong>Contract Number:</strong> ${mf('document_number')}</p>
<p><strong>Date:</strong> ${mf('generated_date')}</p>

<h2>Parties</h2>
<p>
  <strong>Service Provider:</strong> ${mf('company_name')}<br>
  ${mf('company_address')}<br>
  ${mf('company_phone')} | ${mf('company_email')}
</p>
<p>
  <strong>Customer:</strong> ${mf('customer_full_name')}<br>
  ${mf('customer_phone')}<br>
  ${mf('customer_email')}
</p>

<h2>Move Details</h2>
<p>
  <strong>Move Date:</strong> ${mf('move_date')}<br>
  <strong>Service Type:</strong> ${mf('service_type')}<br>
  <strong>Move Size:</strong> ${mf('move_size')}
</p>
<p><strong>Origin:</strong> ${mf('origin_address')}</p>
<p><strong>Destination:</strong> ${mf('destination_address')}</p>

<h2>Package &amp; Pricing</h2>
<p>
  ${mf('package_name')}<br>
  ${mf('num_trucks')} truck(s), ${mf('num_crew')} movers<br>
  Rate: ${mf('hourly_rate')}
</p>
${mf('charges_table')}
<p>
  <strong>Estimated Total:</strong> ${mf('estimated_total')}<br>
  <strong>Deposit Required:</strong> ${mf('deposit_required')}
</p>

<h2>Terms &amp; Conditions</h2>
<p>[Insert contract terms here. Have your legal counsel review before use.]</p>

<h2>Agreement</h2>
<p>By signing below, the customer acknowledges and agrees to the terms stated in this contract.</p>
${mf('signature_block')}

<p><strong>Kratos Moving — Done As Promised.</strong></p>
`.trim()

const INVOICE_HTML = `
<h1>Invoice</h1>
<p><strong>Invoice Number:</strong> ${mf('document_number')}</p>
<p><strong>Date:</strong> ${mf('generated_date')}</p>

<h2>Bill To</h2>
<p>${mf('customer_full_name')}<br>${mf('customer_phone')}<br>${mf('customer_email')}</p>

<h2>Move Details</h2>
<p>
  <strong>Move Date:</strong> ${mf('move_date')}<br>
  <strong>Origin:</strong> ${mf('origin_address')}<br>
  <strong>Destination:</strong> ${mf('destination_address')}
</p>

<h2>Charges</h2>
${mf('charges_table')}
<p>
  <strong>Subtotal:</strong> ${mf('subtotal')}<br>
  <strong>HST (13%):</strong> ${mf('hst')}<br>
  <strong>Total:</strong> ${mf('estimated_total')}<br>
  <strong>Deposit Paid:</strong> ${mf('deposit_required')}<br>
  <strong>Balance Due:</strong> ${mf('balance_due')}
</p>

<hr>
<p>Payment is due on or before the move date. Thank you for choosing ${mf('company_name')}.</p>
<p><strong>Kratos Moving — Done As Promised.</strong></p>
`.trim()

const WAIVER_HTML = `
<h1>Damage Waiver</h1>
<p><strong>Reference:</strong> ${mf('document_number')}</p>
<p><strong>Date:</strong> ${mf('generated_date')}</p>

<h2>Customer</h2>
<p>${mf('customer_full_name')}<br>Move Date: ${mf('move_date')}</p>

<h2>Waiver Terms</h2>
<p>[Insert damage waiver terms here. Have your legal counsel review before use.]</p>
<p>[Describe coverage limits, liability caps, and customer acknowledgement of item conditions.]</p>

<h2>Customer Acknowledgement</h2>
<p>By signing below, the customer acknowledges the above waiver terms.</p>
${mf('signature_block')}

<p><strong>Kratos Moving — Done As Promised.</strong></p>
`.trim()

const WORK_ORDER_HTML = `
<h1>Work Order</h1>
<p><strong>Work Order Number:</strong> ${mf('document_number')}</p>
<p><strong>Date:</strong> ${mf('generated_date')}</p>

<h2>Job Details</h2>
<p>
  <strong>Customer:</strong> ${mf('customer_full_name')} | ${mf('customer_phone')}<br>
  <strong>Move Date:</strong> ${mf('move_date')}<br>
  <strong>Service Type:</strong> ${mf('service_type')}<br>
  <strong>Move Size:</strong> ${mf('move_size')}
</p>

<h2>Addresses</h2>
<p>
  <strong>Pick-up:</strong> ${mf('origin_address')} (${mf('origin_dwelling_type')})<br>
  <strong>Drop-off:</strong> ${mf('destination_address')} (${mf('destination_dwelling_type')})
</p>

<h2>Crew Assignment</h2>
<p>
  <strong>Package:</strong> ${mf('package_name')}<br>
  <strong>Trucks:</strong> ${mf('num_trucks')}<br>
  <strong>Movers:</strong> ${mf('num_crew')}<br>
  <strong>Rate:</strong> ${mf('hourly_rate')}
</p>

<h2>Special Instructions</h2>
<p>[Add any special instructions, access notes, or dispatcher notes here.]</p>

<hr>
<p>Assigned by: ${mf('agent_full_name')} | ${mf('company_name')}</p>
`.trim()

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES = [
  { name: 'Estimate for Moving Services', category: 'opportunity_estimate', content_html: ESTIMATE_HTML },
  { name: 'Contract for Moving Services', category: 'opportunity_contract', content_html: CONTRACT_HTML },
  { name: 'Invoice', category: 'opportunity_invoice', content_html: INVOICE_HTML },
  { name: 'Damage Waiver', category: 'opportunity_addendum', content_html: WAIVER_HTML },
  { name: 'Work Order', category: 'job_work_order', content_html: WORK_ORDER_HTML },
]

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding document templates...\n')

  for (const t of TEMPLATES) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('document_templates')
      .select('id, name')
      .eq('name', t.name)
      .eq('category', t.category)
      .neq('is_deleted', true)
      .maybeSingle()

    if (existing) {
      console.log(`  ⏭  Skipped (exists): ${t.name}`)
      continue
    }

    const { error } = await supabase.from('document_templates').insert({
      name: t.name,
      category: t.category,
      content_html: t.content_html,
      status: 'draft',
    })

    if (error) {
      console.error(`  ❌ Error inserting "${t.name}": ${error.message}`)
    } else {
      console.log(`  ✅ Created: ${t.name}`)
    }
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
