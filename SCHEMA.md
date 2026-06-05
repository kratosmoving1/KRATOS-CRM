# Kratos CRM — Database Schema

This file is the authoritative reference for the current state of the Supabase database. Before writing code that touches any column, verify the column name exists EXACTLY as listed here.

If you need to add a column, follow the workflow in CLAUDE.md (SQL via Supabase Editor, then update this file and `types/database.ts`).

**Last updated:** 2026-05-27 (added office_calendar_events)
**Generated from:** `types/database.ts`

---

## Table: `profiles`

Mirrors `auth.users`. Holds the internal-staff profile for every authenticated user.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | FK to `auth.users(id)` |
| `full_name` | `text` | Display name |
| `email` | `text` | Login email |
| `role` | `text` | One of: `owner`, `admin`, `manager`, `sales`, `dispatcher`, `crew`, `viewer`, `sales_manager`, `senior_sales`, `junior_sales`, `accountant`, `ops_manager` |
| `avatar_url` | `text \| null` | Profile picture URL |
| `is_active` | `boolean` | False = soft-deactivated, denied access |
| `company_id` | `uuid \| null` | Multi-company placeholder (unused) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

## Table: `lead_sources`

Lookup table of marketing channels and referral sources.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `name` | `text` | Display name (e.g. "Google Ads", "Referral") |
| `category` | `'paid' \| 'organic' \| 'referral' \| 'repeat' \| 'other' \| null` | Grouping for reporting |
| `is_active` | `boolean` | False = hidden from dropdowns |
| `created_at` | `timestamptz` | |

---

## Table: `customers`

One record per customer. A customer can have many opportunities.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `full_name` | `text` | Customer full name |
| `email` | `text \| null` | Primary email |
| `phone` | `text \| null` | Primary phone (digits only, no formatting) |
| `phone_type` | `text \| null` | One of: `mobile`, `home`, `work`, `other` |
| `secondary_phone` | `text \| null` | Secondary phone number |
| `secondary_phone_type` | `text \| null` | Type for secondary phone |
| `notes` | `text \| null` | Internal notes about this customer |
| `company_id` | `uuid \| null` | Multi-company placeholder (unused) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `is_deleted` | `boolean` | Soft delete flag — never hard-delete |

---

## Table: `opportunities`

Core record for every move job. One customer can have many opportunities.

### Identity & assignment

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `opportunity_number` | `text` | Human-readable reference (e.g. "K-1042") |
| `customer_id` | `uuid` | FK to `customers.id` |
| `sales_agent_id` | `uuid \| null` | FK to `profiles.id` — assigned sales rep |
| `lead_source_id` | `uuid \| null` | FK to `lead_sources.id` |
| `company_division` | `text \| null` | Internal division (unused) |
| `company_id` | `uuid \| null` | Multi-company placeholder (unused) |

### Status & service type

| Column | Type | Description |
|---|---|---|
| `status` | `'opportunity' \| 'booked' \| 'completed' \| 'closed' \| 'cancelled'` | Current pipeline status |
| `service_type` | `'local' \| 'long_distance' \| 'commercial' \| 'packing' \| 'storage' \| 'international'` | Type of move |
| `move_size` | `text \| null` | e.g. `studio`, `1_bedroom`, `2_bedroom`, `3_bedroom`, `4_bedroom`, `5_bedroom_plus`, `office`, `storage` |
| `service_date` | `date \| null` | Scheduled move date; null = TBD |

### Financials

| Column | Type | Description |
|---|---|---|
| `total_amount` | `numeric` | Total job revenue (default 0) |
| `estimated_cost` | `numeric` | Internal cost estimate (default 0) |
| `deposit_amount` | `numeric \| null` | Deposit received or charged |

### Legacy location fields (kept for compat)

| Column | Type | Description |
|---|---|---|
| `pickup_city` | `text \| null` | Legacy city field — prefer `origin_city` |
| `dropoff_city` | `text \| null` | Legacy city field — prefer `dest_city` |

### Origin address

| Column | Type | Description |
|---|---|---|
| `origin_address_line1` | `text \| null` | Street address |
| `origin_address_line2` | `text \| null` | Unit / apt / suite |
| `origin_city` | `text \| null` | City |
| `origin_province` | `text \| null` | Province (2-letter code, e.g. `ON`) |
| `origin_postal_code` | `text \| null` | Postal code |
| `origin_place_id` | `text \| null` | Google Places ID for the address |
| `origin_dwelling_type` | `text \| null` | One of: `house`, `apartment`, `condo`, `townhouse`, `storage`, `office`, `other` |
| `origin_floor` | `integer \| null` | Floor number (for apartments/condos) |
| `origin_has_elevator` | `boolean \| null` | Whether elevator is available |
| `origin_stairs_count` | `integer \| null` | Number of stairs (flights or steps) |
| `origin_long_carry` | `boolean \| null` | Whether a long carry from parking is needed |
| `origin_parking_notes` | `text \| null` | Free-text parking/access notes |

### Destination address

| Column | Type | Description |
|---|---|---|
| `dest_address_line1` | `text \| null` | Street address |
| `dest_address_line2` | `text \| null` | Unit / apt / suite |
| `dest_city` | `text \| null` | City |
| `dest_province` | `text \| null` | Province (2-letter code, e.g. `ON`) |
| `dest_postal_code` | `text \| null` | Postal code |
| `dest_place_id` | `text \| null` | Google Places ID for the address |
| `dest_dwelling_type` | `text \| null` | One of: `house`, `apartment`, `condo`, `townhouse`, `storage`, `office`, `other` |
| `dest_floor` | `integer \| null` | Floor number |
| `dest_has_elevator` | `boolean \| null` | Whether elevator is available |
| `dest_stairs_count` | `integer \| null` | Number of stairs |
| `dest_long_carry` | `boolean \| null` | Whether a long carry is needed |
| `dest_parking_notes` | `text \| null` | Free-text parking/access notes |

### Internal

| Column | Type | Description |
|---|---|---|
| `notes` | `text \| null` | Internal notes (sales tab) |

### Timestamps

| Column | Type | Description |
|---|---|---|
| `created_at` | `timestamptz` | Record created |
| `updated_at` | `timestamptz` | Last updated |
| `booked_at` | `timestamptz \| null` | When status changed to `booked` |
| `contacted_at` | `timestamptz \| null` | When first contact was logged |
| `quote_sent_at` | `timestamptz \| null` | When estimate was sent to customer |
| `accepted_at` | `timestamptz \| null` | When customer accepted the estimate |
| `completed_at` | `timestamptz \| null` | When status changed to `completed` |
| `closed_at` | `timestamptz \| null` | When status changed to `closed` |
| `cancelled_at` | `timestamptz \| null` | When status changed to `cancelled` |
| `lost_at` | `timestamptz \| null` | When marked as lost (unused in 5-status model) |
| `estimate_sent_at` | `timestamptz \| null` | When estimate portal link was sent |
| `estimate_sent_by` | `uuid \| null` | FK to `profiles.id` — who sent the estimate |
| `is_deleted` | `boolean` | Soft delete flag — never hard-delete |

---

## Table: `audit_log`

Lightweight in-app activity log. Used for the opportunity timeline feed.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid \| null` | FK to `profiles.id` — who performed the action |
| `entity_type` | `text` | e.g. `opportunity`, `customer` |
| `entity_id` | `uuid` | ID of the affected record |
| `action` | `'create' \| 'update' \| 'delete' \| 'status_change'` | What happened |
| `diff` | `jsonb \| null` | Free-form JSON payload describing the change |
| `created_at` | `timestamptz` | |

---

## Table: `audit_logs`

Structured, detailed audit trail for compliance. Separate from `audit_log`. Written by `logAuditEvent()` in `lib/audit/logAuditEvent.ts`.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `actor_user_id` | `uuid \| null` | FK to `profiles.id` |
| `action` | `text` | Verb: `create`, `update`, `delete`, etc. |
| `entity_type` | `text` | e.g. `opportunity`, `customer` |
| `entity_id` | `uuid \| null` | ID of the affected record |
| `old_data` | `jsonb \| null` | Full record snapshot before change |
| `new_data` | `jsonb \| null` | Full record snapshot after change |
| `ip_address` | `text \| null` | Request origin IP |
| `user_agent` | `text \| null` | Browser/client user agent |
| `created_at` | `timestamptz` | |

> Note: Two audit tables exist — `audit_log` (lightweight, feeds the timeline UI) and `audit_logs` (detailed, structured). Most write operations log to both.

---

## Table: `tasks`

Internal to-do items that can optionally be linked to an opportunity.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `title` | `text` | Task title |
| `description` | `text \| null` | Additional detail |
| `due_date` | `date \| null` | Due date |
| `due_time` | `time \| null` | Due time |
| `priority` | `'low' \| 'normal' \| 'high' \| 'urgent'` | Priority level |
| `assigned_to_id` | `uuid \| null` | FK to `profiles.id` |
| `created_by_id` | `uuid \| null` | FK to `profiles.id` |
| `opportunity_id` | `uuid \| null` | FK to `opportunities.id` (optional) |
| `status` | `'pending' \| 'completed' \| 'cancelled'` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

## Table: `follow_ups`

Scheduled follow-up actions linked to opportunities.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `follow_up_date` | `date` | Scheduled date |
| `follow_up_time` | `time \| null` | Scheduled time (optional) |
| `type` | `'call' \| 'email' \| 'sms' \| 'in_person' \| 'other'` | Method |
| `notes` | `text \| null` | What to discuss or do |
| `assigned_to_id` | `uuid \| null` | FK to `profiles.id` |
| `created_by_id` | `uuid \| null` | FK to `profiles.id` |
| `opportunity_id` | `uuid \| null` | FK to `opportunities.id` |
| `completed_at` | `timestamptz \| null` | When it was marked done; null = incomplete |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

## Table: `communications`

Every interaction logged against an opportunity: notes, calls, SMS, emails.

**Verified against live DB on 2026-06-03** via REST API (`GET /rest/v1/communications?limit=1`). The columns below are the actual live columns. Five columns that appeared in earlier versions of this file (`phone_number`, `status`, `provider`, `provider_message_id`, `error_message`) **do not exist** in the production database — do not reference them in code.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `opportunity_id` | `uuid \| null` | FK to `opportunities.id` |
| `customer_id` | `uuid \| null` | FK to `customers.id` |
| `type` | `'note' \| 'email' \| 'call' \| 'sms'` | Communication channel |
| `direction` | `'inbound' \| 'outbound' \| 'internal' \| null` | Who initiated |
| `subject` | `text \| null` | Email subject line (email only) |
| `body` | `text` | Message body or call notes — NOT NULL |
| `call_outcome` | `'connected' \| 'voicemail' \| 'no_answer' \| 'wrong_number' \| 'busy' \| 'pending' \| 'left_live_message' \| 'number_disconnected' \| null` | Result for call-type records |
| `call_duration_seconds` | `integer \| null` | Call length |
| `email_to` | `text \| null` | Recipient email address (email only) |
| `email_cc` | `text \| null` | CC email address (email only) |
| `created_by` | `uuid \| null` | FK to `profiles.id` |
| `company_id` | `uuid \| null` | Multi-company placeholder (unused) |
| `created_at` | `timestamptz` | |
| `is_deleted` | `boolean` | Soft delete flag |

> **If you need `phone_number`, `status`, `provider`, or `provider_message_id`:** run the SQL to add them first, then update this file and regenerate `types/database.ts`.

---

## Table: `payments`

Payment records linked to opportunities. Supports both Stripe and manual (record-only) entries.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `opportunity_id` | `uuid \| null` | FK to `opportunities.id` |
| `quote_id` | `uuid \| null` | Reserved for future quote records |
| `customer_id` | `uuid \| null` | FK to `customers.id` |
| `method` | `text` | e.g. `cash`, `check`, `credit_card`, `interac_e_transfer`, `wire_transfer` |
| `status` | `text` | e.g. `received`, `pending`, `refunded` |
| `amount_cents` | `integer` | Amount in cents (e.g. 50000 = $500.00 CAD) |
| `currency` | `text` | e.g. `cad` |
| `provider` | `text` | e.g. `stripe`, `manual` |
| `reference_number` | `text \| null` | Cheque number, e-transfer ref, etc. |
| `notes` | `text \| null` | Internal notes about the payment |
| `payment_date` | `date` | Date payment was received |
| `stripe_checkout_session_id` | `text \| null` | Stripe Checkout session ID |
| `stripe_payment_intent_id` | `text \| null` | Stripe PaymentIntent ID |
| `created_by` | `uuid \| null` | FK to `profiles.id` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `is_deleted` | `boolean` | Soft delete flag |

---

## Table: `estimate_portal_links`

Tokens for customer-facing estimate portal links. One per send event.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `opportunity_id` | `uuid` | FK to `opportunities.id` |
| `quote_id` | `uuid \| null` | Reserved for future versioned quotes |
| `token` | `text` | URL-safe unique token (used in `/portal/estimate/[token]`) |
| `expires_at` | `timestamptz \| null` | When the link expires; null = never |
| `created_by` | `uuid \| null` | FK to `profiles.id` — who generated the link |
| `created_at` | `timestamptz` | |
| `last_viewed_at` | `timestamptz \| null` | When customer last opened the portal |

---

## Table: `communication_templates`

Reusable message templates for SMS and email, linked to workflow triggers (e.g. no-answer follow-up).

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `name` | `text` | Template display name |
| `channel` | `'sms' \| 'email' \| 'call'` | Which channel this template is for |
| `trigger` | `text` | Workflow trigger key (e.g. `no_answer`) |
| `subject` | `text \| null` | Email subject line (null for SMS/call) |
| `body` | `text` | Message body; may contain `{{variable}}` tokens |
| `is_active` | `boolean` | False = hidden from dropdowns |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

## Table: `opportunity_charges`

Line-item charges attached to an opportunity. Powers the Estimate tab charges builder.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `opportunity_id` | `uuid` | FK to `opportunities.id` (cascade delete) |
| `charge_type` | `text` | One of: `moving_labor`, `transportation`, `packing`, `materials`, `additional_services`, `trip_and_travel`, `fuel_surcharge`, `valuation`, `bulky_item`, `storage`, `storage_in_transit` |
| `name` | `text` | Display name for this line item |
| `description` | `text \| null` | Auto-generated detail string (e.g. "4h @ $189.99/hr") |
| `config` | `jsonb` | Type-specific config — see `lib/charges/calculate.ts` for shape per type |
| `subtotal` | `numeric(10,2)` | Computed subtotal before discount |
| `discount_type` | `'percent' \| 'amount' \| null` | Discount mode |
| `discount_value` | `numeric(10,2) \| null` | Entered discount value (percent or dollar) |
| `discount_amount` | `numeric(10,2)` | Computed dollar discount |
| `total` | `numeric(10,2)` | Final total after discount |
| `is_overridden` | `boolean` | If true, subtotal was manually set (override_reason required) |
| `override_reason` | `text \| null` | Why the subtotal was overridden |
| `sort_order` | `integer` | Display order within this opportunity |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |
| `created_by` | `uuid \| null` | FK to `profiles.id` |
| `updated_by` | `uuid \| null` | FK to `profiles.id` |
| `is_deleted` | `boolean` | Soft delete flag |
| `deleted_at` | `timestamptz \| null` | When soft-deleted |

### New columns added to `opportunities`

| Column | Type | Description |
|---|---|---|
| `tax_rate` | `numeric(5,4)` | HST/tax rate (default 0.13 = Ontario 13%) |
| `tax_exempt` | `boolean` | If true, no tax applied to estimate total |

---

## Table: `document_templates`

Document templates for estimates, contracts, invoices, and other customer-facing or crew-facing documents. Templates contain HTML content with `{{token}}` merge field placeholders.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `name` | `text` | Template display name (e.g. "Estimate for Moving Services") |
| `category` | `text` | One of: `opportunity_estimate`, `opportunity_contract`, `opportunity_addendum`, `opportunity_invoice`, `job_contract`, `job_addendum`, `job_work_order` |
| `description` | `text \| null` | Internal notes about the template |
| `content_html` | `text` | Full HTML content of the template (may contain `.kratos-merge-field` spans) |
| `content_json` | `jsonb \| null` | TipTap JSON representation of the content (for re-hydrating the editor) |
| `status` | `text` | `draft` or `published` |
| `created_by` | `uuid \| null` | FK to `profiles.id` |
| `updated_by` | `uuid \| null` | FK to `profiles.id` |
| `published_by` | `uuid \| null` | FK to `profiles.id` — who published it |
| `published_at` | `timestamptz \| null` | When it was published |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger `trg_document_templates_updated_at` |
| `is_deleted` | `boolean` | Soft delete flag — never hard-delete |
| `deleted_at` | `timestamptz \| null` | When soft-deleted |

---

## Table: `documents`

Generated document instances for a specific opportunity. Each row is a rendered version of a `document_template` applied to real opportunity data.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `opportunity_id` | `uuid` | FK to `opportunities.id` (cascade delete) |
| `template_id` | `uuid \| null` | FK to `document_templates.id` (set null on template delete) |
| `name` | `text` | Document name (copied from template at generation time) |
| `category` | `text` | Category (copied from template, e.g. `opportunity_estimate`) |
| `status` | `text` | One of: `not_started`, `generated`, `sent`, `viewed`, `signed`, `completed` |
| `rendered_html` | `text \| null` | Full rendered HTML with merge fields substituted |
| `rendered_at` | `timestamptz \| null` | When the document was last rendered |
| `sent_at` | `timestamptz \| null` | When marked as sent |
| `sent_to` | `text \| null` | Email address it was sent to |
| `viewed_at` | `timestamptz \| null` | When customer first viewed it |
| `signed_at` | `timestamptz \| null` | When customer signed it |
| `signature_data` | `jsonb \| null` | Signature capture data |
| `document_number` | `text \| null` | Auto-generated reference (e.g. `DOC-K1042-EST`) |
| `created_by` | `uuid \| null` | FK to `profiles.id` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Auto-updated by trigger |
| `is_deleted` | `boolean` | Soft delete flag |
| `deleted_at` | `timestamptz \| null` | When soft-deleted |

---

## Common Mistakes to Avoid

These column name mistakes have appeared repeatedly in past sessions and broken saves:

| ❌ Wrong | ✅ Correct |
|---|---|
| `origin_address_1` | `origin_address_line1` |
| `origin_address_2` | `origin_address_line2` |
| `origin_postal` | `origin_postal_code` |
| `origin_stairs` | `origin_stairs_count` |
| `origin_elevator` | `origin_has_elevator` |
| `origin_long` | `origin_long_carry` |
| `origin_dwelling` | `origin_dwelling_type` |
| `origin_parking` | `origin_parking_notes` |
| `dest_address_1` | `dest_address_line1` |
| `dest_address_2` | `dest_address_line2` |
| `dest_postal` | `dest_postal_code` |
| `dest_stairs` | `dest_stairs_count` |
| `dest_elevator` | `dest_has_elevator` |
| `dest_long` | `dest_long_carry` |
| `dest_dwelling` | `dest_dwelling_type` |
| `dest_parking` | `dest_parking_notes` |

Any AI tool that writes code using a column name from the left column is wrong. The canonical names are in `types/database.ts`.

---

## Table: `office_calendar_events`

Office/team scheduling events — IPCs, surveys, follow-ups, meetings, admin tasks. Separate from booked moving jobs.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `title` | `text` | Event title |
| `description` | `text \| null` | Notes |
| `event_type` | `text` | One of: `IPC`, `On-site Estimate`, `Survey`, `Follow-up`, `Call-back`, `Internal Task`, `Meeting`, `Admin`, `Dispatch`, `Other` |
| `start_at` | `timestamptz` | Event start (required) |
| `end_at` | `timestamptz \| null` | Event end |
| `assigned_to` | `uuid \| null` | FK to `profiles.id` |
| `customer_id` | `uuid \| null` | FK to `customers.id` (optional link) |
| `opportunity_id` | `uuid \| null` | FK to `opportunities.id` (optional link) |
| `location` | `text \| null` | Address or room |
| `status` | `text` | One of: `scheduled`, `completed`, `cancelled`, `no-show` |
| `is_deleted` | `boolean` | Soft delete — never hard-delete |
| `deleted_at` | `timestamptz \| null` | |
| `created_by` | `uuid \| null` | FK to `profiles.id` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
