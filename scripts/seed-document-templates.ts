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
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #222; max-width: 780px; margin: 0 auto;">

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr>
      <td style="vertical-align: middle; width: 50%;">
        <img src="/logo.png" alt="Kratos Moving" style="height: 56px; object-fit: contain; display: block;">
      </td>
      <td style="vertical-align: middle; text-align: right; font-size: 9pt; color: #555; line-height: 1.5;">
        <strong style="color: #222;">Kratos Moving Inc.</strong><br>
        27 Roytec Rd, Woodbridge, ON L4L 8E5<br>
        (800) 321-3222 &nbsp;|&nbsp; info@kratosmoving.ca<br>
        kratosmoving.ca
      </td>
    </tr>
  </table>

  <div style="background: #ffad33; color: #fff; text-align: center; padding: 9px 0; font-size: 13pt; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px;">
    Contract for Moving Services
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
    <tr>
      <td style="border: 1px solid #ccc; padding: 7px 10px; width: 33.33%;">
        <div style="font-size: 7.5pt; text-transform: uppercase; color: #888; margin-bottom: 3px;">Date</div>
        <div style="font-weight: bold;">${mf('move_date')}</div>
      </td>
      <td style="border: 1px solid #ccc; padding: 7px 10px; width: 33.33%;">
        <div style="font-size: 7.5pt; text-transform: uppercase; color: #888; margin-bottom: 3px;">Billing Type</div>
        <div style="font-weight: bold;">Hourly Rate</div>
      </td>
      <td style="border: 1px solid #ccc; padding: 7px 10px; width: 33.33%;">
        <div style="font-size: 7.5pt; text-transform: uppercase; color: #888; margin-bottom: 3px;">Job Number</div>
        <div style="font-weight: bold;">#${mf('quote_number')}</div>
      </td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
    <tr style="background: #f7f7f7;">
      <th style="border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444;">Shipper</th>
      <th style="border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444;">Origin</th>
      <th style="border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444;">Stops</th>
      <th style="border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444;">Destination</th>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 10px; vertical-align: top; line-height: 1.6;">
        <strong>${mf('customer_full_name')}</strong><br>
        ${mf('customer_phone')}<br>
        ${mf('customer_email')}
      </td>
      <td style="border: 1px solid #ccc; padding: 10px; vertical-align: top; line-height: 1.6;">
        ${mf('origin_address')}<br>
        <span style="color: #888; font-size: 9pt;">${mf('origin_dwelling_type')}</span>
      </td>
      <td style="border: 1px solid #ccc; padding: 10px; vertical-align: top; color: #aaa; font-style: italic;">None</td>
      <td style="border: 1px solid #ccc; padding: 10px; vertical-align: top; line-height: 1.6;">
        ${mf('destination_address')}<br>
        <span style="color: #888; font-size: 9pt;">${mf('destination_dwelling_type')}</span>
      </td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
    <tr>
      <td style="border: 1px solid #ccc; padding: 12px; width: 50%; vertical-align: top;">
        <div style="font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; margin-bottom: 8px;">Form of Payment</div>
        <table style="border-collapse: collapse; font-size: 9.5pt; width: 100%;">
          <tr>
            <td style="padding: 3px 0; width: 50%;">&#9744; Credit Card</td>
            <td style="padding: 3px 0;">&#9744; Debit</td>
          </tr>
          <tr>
            <td style="padding: 3px 0;">&#9744; Cash</td>
            <td style="padding: 3px 0;">&#9744; E-Transfer</td>
          </tr>
          <tr>
            <td style="padding: 3px 0 0 0; vertical-align: top;" colspan="2">
              Card / Auth #: <span style="display: inline-block; width: 160px; border-bottom: 1px solid #aaa;">&nbsp;</span>
            </td>
          </tr>
        </table>
      </td>
      <td style="border: 1px solid #ccc; padding: 12px; width: 50%; vertical-align: top;">
        <div style="font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; margin-bottom: 8px;">Hourly Rate — How It Works</div>
        <p style="font-size: 9pt; margin: 0; line-height: 1.55; color: #333;">
          The clock starts when our crew leaves the Kratos facility and ends when they return. Travel time is included.
          Time is billed to the nearest quarter-hour. A minimum billing period applies. Extra charges may apply for
          stairs, elevators, long walks, or specialty items. HST (13%) applies to all charges.
        </p>
      </td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
    <tr>
      <th colspan="2" style="background: #ffad33; color: #fff; padding: 7px 10px; font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; text-align: left;">
        Shipper Authorization &mdash; Must Sign Before Loading
      </th>
    </tr>
    <tr>
      <td colspan="2" style="border: 1px solid #ccc; padding: 12px; font-size: 9pt; line-height: 1.6; color: #333;">
        I, the undersigned, authorize Kratos Moving Inc. to perform the moving services described in this contract at the
        hourly rate specified. I understand the billing method, agree to pay in full upon delivery, and confirm that all
        information provided is accurate. I have read and accept these terms and conditions.
        <br><br>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 60%; padding-top: 12px; padding-right: 24px;">
              <div style="border-bottom: 1px solid #222; padding-bottom: 2px; min-height: 32px;">&nbsp;</div>
              <div style="font-size: 8pt; color: #888; margin-top: 3px;">Customer Signature</div>
            </td>
            <td style="width: 40%; padding-top: 12px;">
              <div style="border-bottom: 1px solid #222; padding-bottom: 2px; min-height: 32px;">&nbsp;</div>
              <div style="font-size: 8pt; color: #888; margin-top: 3px;">Date</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
    <tr style="background: #f7f7f7;">
      <th style="border: 1px solid #ccc; padding: 7px 10px; text-align: center; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; width: 25%;">Start Time</th>
      <th style="border: 1px solid #ccc; padding: 7px 10px; text-align: center; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; width: 25%;">End Time</th>
      <th style="border: 1px solid #ccc; padding: 7px 10px; text-align: center; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; width: 25%;">Travel Time</th>
      <th style="border: 1px solid #ccc; padding: 7px 10px; text-align: center; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; width: 25%;">Deductions</th>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 24px 10px;">&nbsp;</td>
      <td style="border: 1px solid #ccc; padding: 24px 10px;">&nbsp;</td>
      <td style="border: 1px solid #ccc; padding: 24px 10px;">&nbsp;</td>
      <td style="border: 1px solid #ccc; padding: 24px 10px;">&nbsp;</td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
    <tr style="background: #f7f7f7;">
      <th style="border: 1px solid #ccc; padding: 7px 10px; text-align: center; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; width: 25%;">Crew(s)</th>
      <th style="border: 1px solid #ccc; padding: 7px 10px; text-align: center; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; width: 25%;">Truck(s)</th>
      <th style="border: 1px solid #ccc; padding: 7px 10px; text-align: center; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; width: 25%;">Pricing Rate</th>
      <th style="border: 1px solid #ccc; padding: 7px 10px; text-align: center; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444; width: 25%;">Billed Time</th>
    </tr>
    <tr style="text-align: center;">
      <td style="border: 1px solid #ccc; padding: 14px 10px; font-size: 13pt; font-weight: bold;">${mf('num_crew')}</td>
      <td style="border: 1px solid #ccc; padding: 14px 10px; font-size: 13pt; font-weight: bold;">${mf('num_trucks')}</td>
      <td style="border: 1px solid #ccc; padding: 14px 10px; font-size: 13pt; font-weight: bold;">${mf('hourly_rate')}</td>
      <td style="border: 1px solid #ccc; padding: 14px 10px;">&nbsp;</td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
    <tr>
      <th colspan="2" style="background: #ffad33; color: #fff; padding: 7px 10px; font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; text-align: left;">
        Payment Terms &mdash; Must Sign Before Loading
      </th>
    </tr>
    <tr>
      <td colspan="2" style="border: 1px solid #ccc; padding: 12px; font-size: 9pt; line-height: 1.6; color: #333;">
        Full payment is due upon completion of the move before the crew departs the delivery address.
        Items will not be released until payment is received. All amounts are in Canadian dollars plus applicable taxes.
        By signing below, I agree to pay the final billed amount calculated at the rate and crew size shown above.
        <br><br>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 60%; padding-top: 12px; padding-right: 24px;">
              <div style="border-bottom: 1px solid #222; padding-bottom: 2px; min-height: 32px;">&nbsp;</div>
              <div style="font-size: 8pt; color: #888; margin-top: 3px;">Customer Signature</div>
            </td>
            <td style="width: 40%; padding-top: 12px;">
              <div style="border-bottom: 1px solid #222; padding-bottom: 2px; min-height: 32px;">&nbsp;</div>
              <div style="font-size: 8pt; color: #888; margin-top: 3px;">Date</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="page-break-before: always; border-top: 2px dashed #ddd; margin: 0 0 24px 0; padding-top: 24px;"></div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr>
      <td style="vertical-align: middle; width: 50%;">
        <img src="/logo.png" alt="Kratos Moving" style="height: 56px; object-fit: contain; display: block;">
      </td>
      <td style="vertical-align: middle; text-align: right; font-size: 9pt; color: #555; line-height: 1.5;">
        <strong style="color: #222;">Kratos Moving Inc.</strong><br>
        27 Roytec Rd, Woodbridge, ON L4L 8E5<br>
        (800) 321-3222 &nbsp;|&nbsp; info@kratosmoving.ca
      </td>
    </tr>
  </table>
  <div style="border-top: 3px solid #ffad33; margin-bottom: 12px;"></div>
  <p style="font-size: 9pt; color: #888; margin: 0 0 16px 0;">
    Job #${mf('quote_number')} &nbsp;&mdash;&nbsp; ${mf('customer_full_name')} &nbsp;&mdash;&nbsp; ${mf('move_date')}
  </p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
    <tr>
      <th colspan="2" style="background: #ffad33; color: #fff; padding: 7px 10px; font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; text-align: left;">
        Shipper Accepts Delivery of Shipment &mdash; Must Sign After Unloading
      </th>
    </tr>
    <tr>
      <td colspan="2" style="border: 1px solid #ccc; padding: 12px; font-size: 9pt; line-height: 1.6; color: #333;">
        I confirm that all items have been delivered to the destination address. All damage claims must be submitted
        in writing to info@kratosmoving.ca within 24 hours of delivery. No claims will be accepted after this window.
        <br><br>
        <strong>Condition at Delivery:</strong><br>
        <table style="width: 100%; border-collapse: collapse; margin: 8px 0;">
          <tr><td style="padding: 4px 0;">&#9744; All items delivered in satisfactory condition</td></tr>
          <tr><td style="padding: 4px 0;">&#9744; Damage noted &mdash; described below</td></tr>
        </table>
        <div style="border: 1px solid #ccc; padding: 8px; min-height: 64px; margin: 8px 0; background: #fafafa;">&nbsp;</div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
          <tr>
            <td style="width: 60%; padding-top: 12px; padding-right: 24px;">
              <div style="border-bottom: 1px solid #222; padding-bottom: 2px; min-height: 32px;">&nbsp;</div>
              <div style="font-size: 8pt; color: #888; margin-top: 3px;">Customer Signature</div>
            </td>
            <td style="width: 40%; padding-top: 12px;">
              <div style="border-bottom: 1px solid #222; padding-bottom: 2px; min-height: 32px;">&nbsp;</div>
              <div style="font-size: 8pt; color: #888; margin-top: 3px;">Date</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
    <tr style="background: #f7f7f7;">
      <th colspan="3" style="border: 1px solid #ccc; padding: 7px 10px; text-align: left; font-size: 8pt; text-transform: uppercase; font-weight: bold; color: #444;">
        Final Billing Summary
      </th>
    </tr>
    <tr>
      <td style="border: 1px solid #ccc; padding: 7px 10px; font-size: 9pt; width: 34%;">Billed Hours: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
      <td style="border: 1px solid #ccc; padding: 7px 10px; font-size: 9pt; width: 33%;">Hourly Rate: ${mf('hourly_rate')}</td>
      <td style="border: 1px solid #ccc; padding: 7px 10px; font-size: 9pt; width: 33%;">Subtotal: ${mf('subtotal')}</td>
    </tr>
    <tr>
      <td colspan="2" style="border: 1px solid #ccc; padding: 7px 10px; font-size: 9pt;">HST (13%): ${mf('hst')}</td>
      <td style="border: 1px solid #ccc; padding: 7px 10px; font-size: 9.5pt; font-weight: bold;">Total: ${mf('estimated_total')}</td>
    </tr>
  </table>

  <div style="text-align: center; font-size: 8.5pt; color: #aaa; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
    Kratos Moving Inc. &mdash; Done As Promised &nbsp;&bull;&nbsp; kratosmoving.ca &nbsp;&bull;&nbsp; (800) 321-3222 &nbsp;&bull;&nbsp; info@kratosmoving.ca
  </div>

</div>
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
  { name: 'Contract for Moving Services', category: 'job_contract', content_html: CONTRACT_HTML, status: 'published' },
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
      status: (t as { status?: string }).status ?? 'draft',
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
