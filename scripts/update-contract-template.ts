/**
 * Update the "Contract for Moving Services" template in Supabase to match
 * the reference document (two pages: contract form + T&C).
 *
 * Run once with:  npx tsx scripts/update-contract-template.ts
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

// ── New contract HTML ─────────────────────────────────────────────────────────

const CONTRACT_HTML = `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #222; max-width: 780px; margin: 0 auto;">

  <!-- ── Header ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr>
      <td style="vertical-align:middle;width:50%;">
        <img src="/logo.png" alt="Kratos Moving" style="height:56px;object-fit:contain;display:block;">
      </td>
      <td style="vertical-align:middle;text-align:right;font-size:9pt;color:#555;line-height:1.5;">
        <strong style="color:#222;">Kratos Moving Inc.</strong>&nbsp;|&nbsp;1 (800) 321-3222<br>
        27 Roytec Rd #8B Woodbridge, ON L4L 8E3
      </td>
    </tr>
  </table>
  <div style="border-top:3px solid #ffad33;margin-bottom:14px;"></div>

  <!-- ── Title banner ── -->
  <div style="background:#ffad33;color:#fff;text-align:center;padding:9px 0;font-size:13pt;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">
    Contract for Moving Services
  </div>

  <!-- ── Date / Billing Type / Job Number ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <td style="border:1px solid #ccc;padding:7px 10px;width:33.33%;">
        <div style="font-size:7.5pt;text-transform:uppercase;color:#888;margin-bottom:3px;">Date</div>
        <div style="font-weight:bold;">{{move_date}}</div>
      </td>
      <td style="border:1px solid #ccc;padding:7px 10px;width:33.33%;">
        <div style="font-size:7.5pt;text-transform:uppercase;color:#888;margin-bottom:3px;">Billing Type</div>
        <div style="font-weight:bold;">Hourly</div>
      </td>
      <td style="border:1px solid #ccc;padding:7px 10px;width:33.33%;">
        <div style="font-size:7.5pt;text-transform:uppercase;color:#888;margin-bottom:3px;">Job Number</div>
        <div style="font-weight:bold;"># {{quote_number}}</div>
      </td>
    </tr>
  </table>

  <!-- ── Shipper / Origin / Stops / Destination ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <th style="border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Shipper</th>
      <th style="border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Origin</th>
      <th style="border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Stops</th>
      <th style="border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Destination</th>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:10px;vertical-align:top;line-height:1.6;">
        <strong>{{customer_full_name}}</strong><br>
        {{customer_phone}}<br>
        {{customer_email}}
      </td>
      <td style="border:1px solid #ccc;padding:10px;vertical-align:top;line-height:1.6;">{{origin_address}}</td>
      <td style="border:1px solid #ccc;padding:10px;vertical-align:top;color:#aaa;font-style:italic;">None planned</td>
      <td style="border:1px solid #ccc;padding:10px;vertical-align:top;line-height:1.6;">{{destination_address}}</td>
    </tr>
  </table>

  <!-- ── Form of Payment / Hourly Rate ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <td style="border:1px solid #ccc;padding:12px;width:50%;vertical-align:top;">
        <div style="font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;margin-bottom:8px;">Form of Payment</div>
        <p style="font-size:9pt;margin:0 0 6px 0;line-height:1.6;">
          Transportation charges are due prior to unloading at the final destination. Payment methods accepted:
          <u>Cash, Debit, Interac e-Transfer, Credit.</u> Please be advised that Credit Card payments will incur a fee.
        </p>
        <p style="font-size:9pt;margin:0 0 10px 0;line-height:1.4;font-weight:bold;">
          THIS IS THE MAXIMUM AMOUNT THE SHIPPER COULD BE REQUIRED TO PAY FOR THE LISTED SERVICES. --
        </p>
        <table style="border-collapse:collapse;font-size:9.5pt;width:100%;margin-top:6px;">
          <tr>
            <td style="padding:3px 0;width:50%;">&#9744; Credit Card</td>
            <td style="padding:3px 0;">&#9744; Debit</td>
          </tr>
          <tr>
            <td style="padding:3px 0;">&#9744; Cash</td>
            <td style="padding:3px 0;">&#9744; E-Transfer</td>
          </tr>
          <tr>
            <td style="padding:3px 0 0 0;vertical-align:top;" colspan="2">
              Card / Auth #: <span style="display:inline-block;width:160px;border-bottom:1px solid #aaa;">&nbsp;</span>
            </td>
          </tr>
        </table>
      </td>
      <td style="border:1px solid #ccc;padding:12px;width:50%;vertical-align:top;">
        <div style="font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;margin-bottom:8px;">Hourly Rate (Determined by Actual Number of Hours Required to Complete Move)</div>
        <p style="font-size:9pt;margin:0 0 8px 0;line-height:1.55;color:#333;">
          The number of actual hours worked will be determined by the exact time the movers/carrier begins working as per the contract.
          Please note that if Carrier is unable to fit all of Shipper's household goods in the Moving truck, additional time will be required for additional trips.
          I agree to accept this proposal with an hourly rate quote and do not require the estimated number of hours to complete this proposal.
          Furthermore, I acknowledge and accept that there is a <strong>3 - hour minimum</strong>.
          I also concur with any potential travel time charges, which may be applicable for destinations considered "long distances".
          The criteria for designating a destination as "long distance" is solely at the discretion of the management.
        </p>
        <p style="font-size:9pt;margin:0;line-height:1.55;color:#333;">
          In the event of an outstanding balance, I hereby authorize Kratos Moving Inc. to charge the credit card on file or
          utilize any other available payment method to ensure full settlement of the remaining amount.
        </p>
      </td>
    </tr>
  </table>

  <!-- ── Shipper Authorization ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <th colspan="2" style="background:#ffad33;color:#fff;padding:7px 10px;font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;text-align:left;">
        Shipper Authorization &mdash; Must Sign Before Loading
      </th>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #ccc;padding:12px;font-size:9pt;line-height:1.6;color:#333;">
        Shipper hereby authorizes the moving services listed below and accepts the terms and conditions of this contract and any addendum(s).
        <br><br>
        <div style="border-bottom:1px solid #222;padding-bottom:2px;min-height:32px;">&nbsp;</div>
        <div style="font-size:8pt;color:#888;margin-top:3px;">Shipper or Carrier*</div>
      </td>
    </tr>
  </table>

  <!-- ── Time table ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <th style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Start Time</th>
      <th style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">End Time</th>
      <th style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Travel</th>
      <th style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Deductions</th>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:24px 10px;">&nbsp;</td>
      <td style="border:1px solid #ccc;padding:24px 10px;">&nbsp;</td>
      <td style="border:1px solid #ccc;padding:24px 10px;text-align:center;color:#aaa;">--</td>
      <td style="border:1px solid #ccc;padding:24px 10px;">&nbsp;</td>
    </tr>
  </table>

  <!-- ── Crew table ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <th style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Crew(s)</th>
      <th style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Truck(s)</th>
      <th style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Pricing Rate ($)</th>
      <th style="border:1px solid #ccc;padding:7px 10px;text-align:center;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;width:25%;">Billed Time</th>
    </tr>
    <tr style="text-align:center;">
      <td style="border:1px solid #ccc;padding:14px 10px;font-size:13pt;font-weight:bold;">{{num_crew}}</td>
      <td style="border:1px solid #ccc;padding:14px 10px;font-size:13pt;font-weight:bold;">{{num_trucks}}</td>
      <td style="border:1px solid #ccc;padding:14px 10px;font-size:13pt;font-weight:bold;">{{hourly_rate}}</td>
      <td style="border:1px solid #ccc;padding:14px 10px;">&nbsp;</td>
    </tr>
  </table>

  <!-- ── Payment Terms ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <th colspan="2" style="background:#ffad33;color:#fff;padding:7px 10px;font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;text-align:left;">
        Payment Terms &mdash; Must Sign Before Loading
      </th>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #ccc;padding:12px;font-size:9pt;line-height:1.6;color:#333;">
        The Shipper has to pay a full amount for the moving services 60 minutes before completion of the job and while the billing department is still open.
        The billing department is open from 9:00 AM - 7:30 PM on weekdays and from 9:00 AM - 6:00 PM on weekends.
        If the billing department is closed, we reserve the right to receive payment in advance.
        <br><br>
        <div style="border-bottom:1px solid #222;padding-bottom:2px;min-height:32px;">&nbsp;</div>
        <div style="font-size:8pt;color:#888;margin-top:3px;">Shipper or Carrier*</div>
      </td>
    </tr>
  </table>

  <!-- ── Shipper Accepts Delivery ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <th colspan="2" style="background:#ffad33;color:#fff;padding:7px 10px;font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;text-align:left;">
        Shipper Accepts Delivery of Shipment &mdash; Must Sign After Unloading
      </th>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #ccc;padding:12px;font-size:9pt;line-height:1.6;color:#333;">
        <div style="border-bottom:1px solid #222;padding-bottom:2px;min-height:32px;">&nbsp;</div>
        <div style="font-size:8pt;color:#888;margin-top:3px;">Shipper or Carrier*</div>
      </td>
    </tr>
  </table>

  <!-- ── Final Billing Summary ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <th colspan="3" style="background:#f7f7f7;border:1px solid #ccc;padding:7px 10px;text-align:left;font-size:8pt;text-transform:uppercase;font-weight:bold;color:#444;">
        Final Billing Summary
      </th>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:7px 10px;font-size:9pt;width:34%;">Billed Hours: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
      <td style="border:1px solid #ccc;padding:7px 10px;font-size:9pt;width:33%;">Hourly Rate: {{hourly_rate}}</td>
      <td style="border:1px solid #ccc;padding:7px 10px;font-size:9pt;width:33%;">Subtotal: {{subtotal}}</td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #ccc;padding:7px 10px;font-size:9pt;">HST (13%): {{hst}}</td>
      <td style="border:1px solid #ccc;padding:7px 10px;font-size:9.5pt;font-weight:bold;">Total: {{estimated_total}}</td>
    </tr>
  </table>

  <!-- ── Page 1 footer ── -->
  <div style="text-align:center;font-size:8.5pt;color:#aaa;margin-top:8px;border-top:1px solid #eee;padding-top:10px;">
    Kratos Moving Inc. &mdash; Done As Promised &nbsp;&bull;&nbsp; kratosmoving.ca &nbsp;&bull;&nbsp; (800) 321-3222 &nbsp;&bull;&nbsp; info@kratosmoving.ca
  </div>

  <!-- ═══════════════ PAGE 2 ═══════════════ -->
  <div style="page-break-before:always;padding-top:24px;"></div>

  <!-- ── Page 2 header ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr>
      <td style="vertical-align:middle;width:50%;">
        <img src="/logo.png" alt="Kratos Moving" style="height:56px;object-fit:contain;display:block;">
      </td>
      <td style="vertical-align:middle;text-align:right;font-size:9pt;color:#555;line-height:1.5;">
        <strong style="color:#222;">Kratos Moving Inc.</strong>&nbsp;|&nbsp;1 (800) 321-3222<br>
        27 Roytec Rd #8B Woodbridge, ON L4L 8E3
      </td>
    </tr>
  </table>

  <h2 style="color:#ffad33;font-size:12pt;margin:8px 0 4px 0;">Inventory Declared</h2>
  <div style="border-top:2px solid #ffad33;margin-bottom:16px;"></div>

  <h2 style="color:#ffad33;font-size:12pt;text-align:center;margin:0 0 14px 0;">Terms &amp; Conditions</h2>

  <h3 style="font-size:9.5pt;margin:0 0 6px 0;">Customer Responsibilities:</h3>
  <ol style="margin:0 0 12px 0;padding-left:20px;font-size:9pt;line-height:1.6;list-style-type:upper-roman;">
    <li style="margin-bottom:6px;"><strong>Accurate Inventory:</strong> The Customer must provide an accurate and detailed inventory of all items to be moved, including their condition and any special handling requirements, prior to the commencement of the moving services. The Customer acknowledges that failure to provide accurate information may affect the Company's ability to execute the moving services efficiently and relieve the Company of any liability for damages resulting from incomplete or inaccurate information.</li>
    <li style="margin-bottom:6px;"><strong>Access and Information:</strong> The Customer shall provide the Company with accurate information regarding the access points, parking arrangements, and any restrictions or regulations related to the pickup and delivery locations. The Customer acknowledges that any delays or additional costs incurred due to the inaccuracy or insufficiency of this information shall be the sole responsibility of the Customer.</li>
    <li style="margin-bottom:6px;"><strong>Prohibited Items:</strong> The Customer agrees not to include hazardous materials, perishable items, live plants, cash, jewelry, valuable documents, or illegal substances among the belongings to be moved. The Company reserves the right to refuse the transport of any such items.</li>
  </ol>

  <h3 style="font-size:9.5pt;margin:0 0 6px 0;">Payment and Billing:</h3>
  <ol style="margin:0 0 12px 0;padding-left:20px;font-size:9pt;line-height:1.6;list-style-type:upper-roman;">
    <li style="margin-bottom:6px;"><strong>Quotation:</strong> The Company shall provide the Customer with a written quotation, including the estimated cost of the moving services, any additional charges, and payment terms. The quotation provided is an estimate based on the information and details provided by the Customer. The Customer acknowledges that the nature of tasks can vary, and as such, the actual hours required to complete the service may differ from the initial estimate, being either shorter or longer based on the specific challenges and requirements of the move. Consequently, the final cost may adjust according to the actual services rendered.</li>
    <li style="margin-bottom:6px;"><strong>Payment:</strong> Payment can be made in cash, card, certified cheque, or electronic transfer, unless otherwise agreed upon in writing. In the event that payment for the moving services provided by the Company is not made in full as per agreed terms, the Company reserves the right to retain possession of the Customer&apos;s items remaining in the truck as a lien for the unpaid balance. These items will be held for a reasonable period, during which the Customer may settle the outstanding balance. Failure to make payment within this period will result in the Company incurring additional storage fees, to be charged to the Customer. If payment is still delayed beyond this reasonable period, the Company reserves the right to keep, auction, or sell the items to compensate for the unpaid balance and any additional costs incurred. Should the terms of payment not be met, the Company reserves the right to charge the Customer&apos;s credit card for any outstanding payments. This includes any accrued storage fees or other related costs due to the delayed payment.</li>
    <li style="margin-bottom:6px;"><strong>Additional Charges:</strong> The Customer shall be responsible for any additional charges incurred due to changes in the scope of services, delays caused by the Customer, or any unforeseen circumstances not previously disclosed. Such charges may include, but are not limited to, storage fees, additional labor costs, or materials required. Additionally, if the Customer has heavy items or appliances not initially mentioned or listed in the provided inventory, these items will be subject to an additional charge. The rate for each additional heavy item or appliance will vary between $50 to $250, depending on the nature, size, and handling requirements of the item. Moreover, the Company reserves the right to refuse to move any item that was not previously disclosed or is deemed unsafe or impractical to transport under standard moving conditions. The Customer is encouraged to provide a complete and accurate inventory of all items to be moved, including heavy items and appliances, to receive a more accurate estimate and avoid these additional charges.</li>
    <li style="margin-bottom:6px;">Please note that if payment is not received within the agreed timeframe, Kratos Moving Inc. reserves the right to automatically charge the credit card on file for any outstanding balance within seventy-two (72) hours of the due date. This measure ensures timely processing and avoids disruption of services.</li>
  </ol>

  <h3 style="font-size:9.5pt;margin:0 0 6px 0;">Credit Card Authorization &amp; Dispute Resolution:</h3>
  <ol style="margin:0 0 12px 0;padding-left:20px;font-size:9pt;line-height:1.6;list-style-type:upper-roman;">
    <li style="margin-bottom:6px;">The Client hereby authorizes the Company to charge the agreed deposit and remaining balance to the credit card provided for services rendered. This authorization extends to any additional charges incurred as a result of changes to the scope of work, overtime, or unforeseen conditions during the service.</li>
    <li style="margin-bottom:6px;">The Client acknowledges that all estimates are based on the information provided at the time of booking and are subject to adjustment. The final cost will reflect the actual time, labor, materials, and services provided, which may vary due to factors such as inventory size, access limitations, number of stairs, distance to truck, wrapping requirements, or other unforeseen site conditions.</li>
    <li style="margin-bottom:6px;">By signing the final contract or job completion form at the conclusion of the move, the Client confirms that the services have been completed to their satisfaction and acknowledges receipt of all items as listed.</li>
    <li style="margin-bottom:6px;">The Client agrees not to initiate a credit card chargeback prior to formally contacting Kratos Moving Inc. in writing to resolve the matter. Any concerns or disputes must be submitted within seven (7) days of service completion. Kratos Moving will investigate and respond in good faith. Failure to adhere to this process may result in the automatic denial of a claim or rejection by the issuing.</li>
    <li style="margin-bottom:6px;">All refund, damage, or billing-related disputes shall be processed in accordance with Kratos Moving Inc.&apos;s Claims and Settlement Policy. Claims must include sufficient documentation (e.g., photos, inventory lists, job records) and will be evaluated objectively based on the company&apos;s internal review.</li>
    <li style="margin-bottom:6px;">The Client affirms that they are the lawful cardholder or have obtained written authorization from the cardholder to use the credit card for this transaction. Any unauthorized use will be treated as fraudulent activity and reported to the appropriate authorities. Kratos Moving reserves the right to request identification prior to processing.</li>
  </ol>

  <h3 style="font-size:9.5pt;margin:0 0 6px 0;">Insurance &amp; Coverage</h3>
  <ol style="margin:0 0 12px 0;padding-left:20px;font-size:9pt;line-height:1.6;list-style-type:upper-roman;">
    <li style="margin-bottom:6px;">The Company provides two levels of protection for all moves. Every move automatically includes Standard Protection, which offers basic liability coverage valued at $0.60 per pound per article. This is not full insurance, but a limited form of coverage in accordance with industry standards. Clients seeking additional protection may upgrade to Full Value Protection (FVP) prior to their move. Under this plan, Kratos Moving assumes greater responsibility and may repair, replace, or reimburse the current market value of any item damaged or lost, in accordance with the selected policy&apos;s terms.</li>
    <li style="margin-bottom:6px;">It is the Client&apos;s responsibility to review both coverage options and select the one that best suits their needs before the move. If no upgrade is requested, Standard Protection will automatically apply.</li>
    <li style="margin-bottom:6px;">All claims for damage, loss, or service issues must be submitted in writing through a Customer Service Ticket within five (5) calendar days following completion of the move. Claims submitted after this period will not be accepted. For moves involving storage or delayed delivery, Kratos Moving may extend this window at its discretion after conducting an internal review, provided that the storage is managed by Kratos Moving.</li>
    <li style="margin-bottom:6px;">Compensation for any claim will be based solely on the coverage selected, and Kratos Moving&apos;s total liability shall not exceed the limits defined by that protection plan.</li>
  </ol>

  <h3 style="font-size:9.5pt;margin:0 0 6px 0;">Governing Law:</h3>
  <ol style="margin:0 0 16px 0;padding-left:20px;font-size:9pt;line-height:1.6;list-style-type:upper-roman;">
    <li>It is the intention of the Company that the provisions of this Agreement shall be construed and enforced according to the laws of the Province of Ontario, Canada, without regard to its conflict of law rules. All controversies and claims arising under this Agreement, and all actions and proceedings, shall be brought to a court of general jurisdiction in Ontario or the Federal court of Canada, and both parties consent to the venue and jurisdiction of these courts. Nothing in this Agreement limits Kratos Moving Inc.&apos;s right to seek provisional injunctive relief in the appropriate jurisdiction.</li>
  </ol>

  <!-- ── Shipper Acknowledgement ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <th colspan="2" style="background:#ffad33;color:#fff;padding:7px 10px;font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;text-align:left;">
        Shipper Acknowledgement (Must Sign Before Loading)
      </th>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #ccc;padding:20px 12px 12px;font-size:9pt;line-height:1.6;color:#333;">
        <div style="border-bottom:1px solid #222;padding-bottom:2px;min-height:32px;">&nbsp;</div>
        <div style="font-size:8pt;color:#888;margin-top:3px;">Shipper or Carrier*</div>
      </td>
    </tr>
  </table>

</div>
`.trim()

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Looking up "Contract for Moving Services" template...')

  const { data: existing, error: fetchErr } = await supabase
    .from('document_templates')
    .select('id, name')
    .eq('name', 'Contract for Moving Services')
    .eq('category', 'job_contract')
    .neq('is_deleted', true)
    .maybeSingle()

  if (fetchErr) {
    console.error('Error fetching template:', fetchErr.message)
    process.exit(1)
  }

  if (!existing) {
    console.log('Template not found — inserting new...')
    const { error: insErr } = await supabase.from('document_templates').insert({
      name: 'Contract for Moving Services',
      category: 'job_contract',
      content_html: CONTRACT_HTML,
      status: 'published',
    })
    if (insErr) { console.error('Insert error:', insErr.message); process.exit(1) }
    console.log('✅ Inserted new template.')
    return
  }

  console.log(`Found template id=${existing.id} — updating content...`)

  const { error: updErr } = await supabase
    .from('document_templates')
    .update({ content_html: CONTRACT_HTML, status: 'published', updated_at: new Date().toISOString() })
    .eq('id', existing.id)

  if (updErr) {
    console.error('Update error:', updErr.message)
    process.exit(1)
  }

  console.log('✅ Contract template updated successfully.')
}

main().catch(err => { console.error(err); process.exit(1) })
