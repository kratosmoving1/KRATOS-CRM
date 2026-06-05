export interface MergeField {
  token: string
  label: string
  description: string
  example: string
  group: MergeFieldGroup
}

export type MergeFieldGroup =
  | 'Customer'
  | 'Opportunity'
  | 'Addresses'
  | 'Package'
  | 'Charges'
  | 'Agent'
  | 'Company'
  | 'Document'

export const MERGE_FIELDS: MergeField[] = [
  // Customer
  { token: 'customer_first_name', label: 'First Name', description: 'Customer first name', example: 'James', group: 'Customer' },
  { token: 'customer_last_name', label: 'Last Name', description: 'Customer last name', example: 'Hurst', group: 'Customer' },
  { token: 'customer_full_name', label: 'Full Name', description: 'Customer full name', example: 'James Hurst', group: 'Customer' },
  { token: 'customer_phone', label: 'Phone', description: 'Customer phone (formatted)', example: '(705) 443-7763', group: 'Customer' },
  { token: 'customer_email', label: 'Email', description: 'Customer email address', example: 'james@example.com', group: 'Customer' },

  // Opportunity
  { token: 'quote_number', label: 'Quote Number', description: 'Opportunity / quote number', example: '10736', group: 'Opportunity' },
  { token: 'move_date', label: 'Move Date', description: 'Scheduled move date', example: 'June 22, 2026', group: 'Opportunity' },
  { token: 'move_size', label: 'Move Size', description: 'Move size label', example: '3 Bedroom House', group: 'Opportunity' },
  { token: 'service_type', label: 'Service Type', description: 'Local / Long-Distance / Storage / etc.', example: 'Local', group: 'Opportunity' },
  { token: 'lead_source', label: 'Lead Source', description: 'How the customer found Kratos', example: 'Google Ads', group: 'Opportunity' },

  // Addresses
  { token: 'origin_address', label: 'Origin Address', description: 'Pick-up full address', example: '27 Roytec Rd, Woodbridge, ON', group: 'Addresses' },
  { token: 'origin_city', label: 'Origin City', description: 'Pick-up city', example: 'Woodbridge', group: 'Addresses' },
  { token: 'origin_dwelling_type', label: 'Origin Dwelling', description: 'Apartment / House / etc.', example: 'Apartment', group: 'Addresses' },
  { token: 'destination_address', label: 'Destination Address', description: 'Drop-off full address', example: '15 Wertheim Court, Richmond Hill, ON', group: 'Addresses' },
  { token: 'destination_city', label: 'Destination City', description: 'Drop-off city', example: 'Richmond Hill', group: 'Addresses' },
  { token: 'destination_dwelling_type', label: 'Destination Dwelling', description: 'Apartment / House / etc.', example: 'House', group: 'Addresses' },

  // Package
  { token: 'package_name', label: 'Package Name', description: 'Bronze / Silver / Gold / Platinum', example: 'Gold Package', group: 'Package' },
  { token: 'num_trucks', label: 'Number of Trucks', description: 'Truck count', example: '1', group: 'Package' },
  { token: 'num_crew', label: 'Number of Movers', description: 'Crew count', example: '3', group: 'Package' },
  { token: 'hourly_rate', label: 'Hourly Rate', description: 'Package hourly rate', example: '$229.99/hr', group: 'Package' },
  { token: 'labor_hours', label: 'Estimated Labour Hours', description: 'Estimated labour hours', example: '3h', group: 'Package' },
  { token: 'minimum_hours', label: 'Minimum Hours', description: 'Minimum billable hours', example: '3h', group: 'Package' },

  // Charges
  { token: 'charges_table', label: 'Charges Table', description: 'Full charges table as HTML', example: '[HTML table of all charges]', group: 'Charges' },
  { token: 'subtotal', label: 'Subtotal', description: 'Charges subtotal', example: '$689.97', group: 'Charges' },
  { token: 'hst', label: 'HST', description: 'HST amount', example: '$89.70', group: 'Charges' },
  { token: 'estimated_total', label: 'Estimated Total', description: 'Grand total', example: '$779.67', group: 'Charges' },
  { token: 'deposit_required', label: 'Deposit Required', description: 'Required deposit amount', example: '$150.00', group: 'Charges' },
  { token: 'balance_due', label: 'Balance Due', description: 'Remaining balance', example: '$629.67', group: 'Charges' },

  // Agent
  { token: 'agent_first_name', label: 'Agent First Name', description: 'Sales agent first name', example: 'Alex', group: 'Agent' },
  { token: 'agent_full_name', label: 'Agent Full Name', description: 'Sales agent full name', example: 'Alex Smith', group: 'Agent' },
  { token: 'agent_email', label: 'Agent Email', description: 'Sales agent email', example: 'alex@kratosmoving.ca', group: 'Agent' },

  // Company
  { token: 'company_name', label: 'Company Name', description: 'Kratos Moving Inc.', example: 'Kratos Moving Inc.', group: 'Company' },
  { token: 'company_phone', label: 'Company Phone', description: 'Main company phone', example: '(800) 321-3222', group: 'Company' },
  { token: 'company_email', label: 'Company Email', description: 'Main company email', example: 'hello@kratosmoving.ca', group: 'Company' },
  { token: 'company_address', label: 'Company Address', description: 'Main company address', example: '27 Roytec Rd, Woodbridge, ON', group: 'Company' },
  { token: 'company_website', label: 'Company Website', description: 'Company URL', example: 'kratosmoving.ca', group: 'Company' },
  { token: 'company_slogan', label: 'Company Slogan', description: 'Done As Promised', example: 'Done As Promised', group: 'Company' },

  // Document
  { token: 'generated_date', label: 'Generated Date', description: 'Document generation date', example: 'June 4, 2026', group: 'Document' },
  { token: 'document_number', label: 'Document Number', description: 'Unique document number', example: 'DOC-10736-EST', group: 'Document' },
  { token: 'signature_block', label: 'Signature Block', description: 'Placeholder for customer e-signature (Phase 3)', example: '[Signature placeholder]', group: 'Document' },
]

export const MERGE_FIELD_GROUPS: MergeFieldGroup[] = [
  'Customer',
  'Opportunity',
  'Addresses',
  'Package',
  'Charges',
  'Agent',
  'Company',
  'Document',
]

export const CATEGORY_LABELS: Record<string, string> = {
  opportunity_estimate: 'Opportunity Estimate',
  opportunity_contract: 'Opportunity Contract',
  opportunity_addendum: 'Opportunity Addendum',
  opportunity_invoice: 'Opportunity Invoice',
  job_contract: 'Job Contract',
  job_addendum: 'Job Addendum',
  job_work_order: 'Job Work Order',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS)
