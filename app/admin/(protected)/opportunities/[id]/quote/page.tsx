'use client'

import { useState, useEffect, useCallback, type ElementType, type ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, ChevronDown, RefreshCw, Trash2, Loader2,
  MapPin, Map as MapIcon, Phone, Mail, FileText, PhoneCall, MessageSquare, AtSign,
  Clock, CheckCircle2, CreditCard, Banknote, Landmark, ReceiptText,
  WalletCards, X, CalendarPlus, Boxes, ArrowRight,
  ClipboardCheck, ShieldCheck, Calendar, Pencil,
  FilePlus, Info, Briefcase, Bell,
} from 'lucide-react'
import { toast } from 'sonner'
import StatusPill from '@/components/ui/StatusPill'
import RingCentralCallButton from '@/components/ui/RingCentralCallButton'
import SendEstimateMenu from '@/components/admin/SendEstimateMenu'
import ChangeStatusModal from '@/components/admin/modals/ChangeStatusModal'
import CreateOpportunityModal from '@/components/admin/modals/CreateOpportunityModal'
import CreateFollowUpModal from '@/components/admin/modals/CreateFollowUpModal'
import QuickEditModal from '@/components/admin/modals/QuickEditModal'
import EditAddressModal, { type EditAddressData } from '@/components/admin/modals/EditAddressModal'
import ChargesSection from '@/components/admin/charges/ChargesSection'
import ChargeSidePanel from '@/components/admin/charges/ChargeSidePanel'
import { PackageTierCards } from '@/components/admin/charges/PackageTierCards'
import type { OpportunityCharge } from '@/components/admin/charges/types'
import { calculateEstimate } from '@/lib/charges/calculate'
import { OPP_STATUSES, MOVE_SIZE_LABELS, MOVE_SIZE_VOLUME } from '@/lib/constants'
import type { OppStatus } from '@/lib/constants'
import { formatCurrency } from '@/lib/format'
import { formatQuoteNumber } from '@/lib/opportunityDisplay'
import { cn } from '@/lib/utils'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local: 'Local', long_distance: 'Long Distance', commercial: 'Commercial',
  packing: 'Packing', storage: 'Storage', international: 'International',
}

const CALL_OUTCOMES: Record<string, string> = {
  connected: 'Connected', voicemail: 'Left Voicemail', no_answer: 'No Answer',
  wrong_number: 'Wrong Number', busy: 'Busy', left_live_message: 'Left Live Message',
  number_disconnected: 'Number Disconnected',
}

const DISPATCH_ADDRESS = '27 Roytec Rd, Woodbridge, ON L4L 8E3, Canada'

interface TripLeg {
  label: string
  from: string
  to: string
  distanceKm: number
  driveTimeMinutes: number
}

type TravelEstimateResult =
  | {
      ok: true
      distanceKm: number
      driveTimeMinutes: number
      directDriveHours: number
      returnTravelHours: number
      recommendedTravelHours: number | null
      manualReviewRequired: boolean
      note: string | null
      provider: string
      legs?: TripLeg[]
      totalDistanceKm?: number
      totalDriveTimeMinutes?: number
      dispatchAddress?: string
    }
  | { ok: false; reason: string; message: string; provider?: string }

function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const mins = m % 60
  return mins > 0 ? `${h}h ${mins}m` : `${h}h`
}

function getMonthLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
}

function buildMapsUrl(opp: OppDetail): string | null {
  const origin = [opp.origin_address_line1, opp.origin_city, opp.origin_province].filter(Boolean).join(', ')
  const dest = [opp.dest_address_line1, opp.dest_city, opp.dest_province].filter(Boolean).join(', ')
  if (!origin || !dest) return null
  const stops = [DISPATCH_ADDRESS, origin, dest, DISPATCH_ADDRESS]
  return `https://www.google.com/maps/dir/${stops.map(encodeURIComponent).join('/')}`
}

function applyMerge(text: string, opp: OppDetail): string {
  const custFirst = (opp.customer?.full_name ?? '').split(' ')[0] || ''
  const agentFirst = (opp.agent?.full_name ?? '').split(' ')[0] || ''
  const moveDate = opp.service_date
    ? new Date(opp.service_date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'
  return text
    .replace(/@FirstName/g,      custFirst || 'there')
    .replace(/@YourFirstName/g,  agentFirst)
    .replace(/@AssignedSalesPersonFirstName/g, agentFirst)
    .replace(/@OriginCity/g,     opp.origin_city ?? '')
    .replace(/@DestinationCity/g, opp.dest_city ?? '')
    .replace(/@MoveDate/g,       moveDate)
    .replace(/@CompanyPhone/g,   '(800) 321-3222')
    .replace(/@SubmitLink/g,     '')
    .replace(/{{customer_name}}/g,      opp.customer?.full_name ?? '')
    .replace(/{{customer_first_name}}/g, custFirst)
    .replace(/{{agent_first_name}}/g,   agentFirst)
    .replace(/{{agent_full_name}}/g,    opp.agent?.full_name ?? '')
    .replace(/{{company_name}}/g,       'Kratos Moving Inc.')
    .replace(/{{move_date}}/g,          moveDate)
    .replace(/{{phone_number}}/g,       opp.customer?.phone ?? '')
    .replace(/{{quote_number}}/g,       formatQuoteNumber(opp.opportunity_number ?? ''))
    .replace(/{{portal_link}}/g,        '')
    .replace(/{{deposit_amount}}/g,     String(opp.deposit_amount ?? 150))
    .replace(/{{[^}]+}}/g,              '')
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
}
function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatDatetime(d: string) {
  return new Date(d).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

interface AuditEntry {
  id: string; action: string; diff: Record<string, unknown> | null; created_at: string
  user: { full_name: string } | null
}

interface OppDetail {
  id: string; opportunity_number: string; status: OppStatus
  service_type: string; service_date: string | null; move_size: string | null
  total_amount: number; estimated_cost: number; deposit_amount?: number | null
  notes: string | null; customer_notes: string | null; crew_notes: string | null; dispatcher_notes: string | null
  origin_address_line1: string | null; origin_address_line2: string | null
  origin_city: string | null; origin_province: string | null
  origin_postal_code: string | null; origin_dwelling_type: string | null
  origin_floor: number | null; origin_has_elevator: boolean | null
  origin_stairs_count: number | null; origin_long_carry: boolean | null
  origin_parking_notes: string | null
  dest_address_line1: string | null; dest_address_line2: string | null
  dest_city: string | null; dest_province: string | null
  dest_postal_code: string | null; dest_dwelling_type: string | null
  dest_floor: number | null; dest_has_elevator: boolean | null
  dest_stairs_count: number | null; dest_long_carry: boolean | null
  dest_parking_notes: string | null
  created_at: string; updated_at: string
  customer: {
    id: string; full_name: string; email: string | null; phone: string | null
    phone_type: string | null; secondary_phone: string | null
  } | null
  agent: { id: string; full_name: string; email: string } | null
  lead_source: { id: string; name: string } | null
  audit_log: AuditEntry[]
  can_view_profitability?: boolean
}

interface TimelineItem {
  id: string
  _kind: 'communication' | 'audit' | 'follow_up'
  type?: string
  direction?: string
  subject?: string
  body?: string
  call_outcome?: string
  call_duration_seconds?: number
  action?: string
  diff?: Record<string, unknown> | null
  // follow_up fields
  follow_up_date?: string
  follow_up_time?: string | null
  notes?: string | null
  status?: string
  completed_at?: string | null
  assignee_name?: string | null
  created_at: string
  actor: string | null
}

type ActivityFilter = 'all' | 'notes' | 'emails' | 'calls' | 'texts' | 'follow_ups'

function getDaysUntilMove(moveDate: string | null | undefined): string | null {
  if (!moveDate) return null
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  if (moveDate === todayKey) return 'Today'
  const diff = Math.round((new Date(moveDate).getTime() - new Date(todayKey).getTime()) / 86_400_000)
  if (diff === 1) return 'Tomorrow'
  if (diff > 1) return `${diff} days`
  return 'Move passed'
}

// Maps DB move_size values to MOVE_SIZE_VOLUME keys
const MOVE_SIZE_VOLUME_MAP: Record<string, string> = {
  studio: 'studio', studio_apartment: 'studio',
  '1_bedroom': '1_bed', '1_bedroom_apartment': '1_bed', '1_bedroom_house': '1_bed',
  '2_bedroom': '2_bed', '2_bedroom_apartment': '2_bed', '2_bedroom_house': '2_bed',
  '3_bedroom': '3_bed', '3_bedroom_apartment': '3_bed', '3_bedroom_house': '3_bed',
  '4_bedroom': '4_bed', '4_bedroom_apartment': '4_bed', '4_bedroom_house': '4_bed',
  '5_bedroom_plus': '5_bed_plus', '5_bedroom_house_plus': '5_bed_plus',
  office: 'small_office', storage: 'pod',
}

function getVolumeForMoveSize(moveSize: string | null | undefined) {
  if (!moveSize) return null
  const key = MOVE_SIZE_VOLUME_MAP[moveSize]
  return key ? (MOVE_SIZE_VOLUME[key] ?? null) : null
}

function packageDisplayName(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  return /package$/i.test(trimmed) ? trimmed : `${trimmed} Package`
}

interface CommunicationTemplate {
  id: string
  name: string
  channel: 'sms' | 'email' | 'call'
  trigger: string
  subject: string | null
  body: string
  is_active: boolean
}

const BUILTIN_EMAIL_TEMPLATES: CommunicationTemplate[] = [
  ['New Lead', 'Your Kratos Moving quote request', 'Hi {{customer_name}},\n\nThanks for reaching out to Kratos Moving. I can help with your quote for {{move_date}}. Reply here or call us at {{phone_number}} and we can confirm the details.\n\n{{agent_first_name}}\n{{company_name}}'],
  ['Follow-Up 1', 'Following up on your Kratos Moving quote', 'Hi {{customer_name}},\n\nJust following up on Quote {{quote_number}}. I am happy to answer questions or adjust the estimate if anything changed.\n\n{{agent_first_name}}'],
  ['Follow-Up 2', 'Still planning your move?', 'Hi {{customer_name}},\n\nChecking in on your move plans for {{move_date}}. We can hold availability once the deposit is completed.\n\n{{agent_first_name}}'],
  ['Follow-Up 3', 'Final follow-up on your moving quote', 'Hi {{customer_name}},\n\nI wanted to make one more quick follow-up on Quote {{quote_number}}. If you still need help, reply here and I will get it updated.\n\n{{agent_first_name}}'],
  ['Deposit', 'Deposit for Quote {{quote_number}}', 'Hi {{customer_name}},\n\nYour deposit to secure the move is {{deposit_amount}}. You can review and complete the quote here: {{portal_link}}\n\n{{company_name}}'],
  ['Inventory Request', 'Inventory details for your move', 'Hi {{customer_name}},\n\nCould you send us your inventory details for Quote {{quote_number}}? This helps us keep the estimate accurate.\n\n{{agent_first_name}}'],
  ['5% Discount', '5% discount for your move', 'Hi {{customer_name}},\n\nWe can apply a 5% discount to help you secure your move. Reply here and I will update Quote {{quote_number}}.\n\n{{agent_first_name}}'],
  ['Lead Lost', 'Closing your moving request', 'Hi {{customer_name}},\n\nWe will close this request for now. If you still need moving help, reply anytime and we can reopen Quote {{quote_number}}.\n\n{{company_name}}'],
  ['Post-Move', 'Thank you for moving with Kratos', 'Hi {{customer_name}},\n\nThank you for choosing Kratos Moving. We hope everything went smoothly.\n\n{{company_name}}'],
  ['Review Request', 'How did we do?', 'Hi {{customer_name}},\n\nThank you for moving with Kratos. If you had a great experience, we would really appreciate a review.\n\n{{company_name}}'],
  ['In-Person Consultation Confirmation', 'In-person consultation confirmed', 'Hi {{customer_name}},\n\nYour in-person consultation with Kratos Moving is confirmed. We will review your move details and answer questions.\n\n{{agent_first_name}}'],
  ['Virtual Consultation Confirmation', 'Virtual consultation confirmed', 'Hi {{customer_name}},\n\nYour virtual consultation with Kratos Moving is confirmed. We will review your inventory and moving details together.\n\n{{agent_first_name}}'],
  ['$35 Gift Card', '$35 gift card offer', 'Hi {{customer_name}},\n\nAs a thank-you, we can include our $35 gift card offer once your move is booked.\n\n{{company_name}}'],
  ['Post-Move 5-Star Review Incentive', 'A thank-you for your review', 'Hi {{customer_name}},\n\nIf your move was a 5-star experience, we would appreciate your review. Reply here once posted and we will follow up on the incentive.\n\n{{company_name}}'],
  ['Dispatcher - Inventory Check Request', 'Inventory check request', 'Hi {{customer_name}},\n\nOur dispatch team is reviewing your move. Please confirm your inventory so we can prepare the right crew and equipment.\n\n{{company_name}}'],
  ['Unavailable - Move Request Decline', 'Move date availability', 'Hi {{customer_name}},\n\nUnfortunately, we are unavailable for your requested move date. If your date is flexible, reply here and we can check alternatives.\n\n{{company_name}}'],
].map(([name, subject, body], index) => ({
  id: `builtin-email-${index}`,
  name,
  channel: 'email',
  trigger: 'sales',
  subject,
  body,
  is_active: true,
}))

const BUILTIN_SMS_TEMPLATES: CommunicationTemplate[] = [
  ['No Pick Up - First Contact Attempt', 'Hi {{customer_name}}, this is {{agent_first_name}} from {{company_name}}. I tried calling about your move request. Reply here or call us back when you can.'],
  ['Second Text - Set Up a Time To Discuss Potential Quote', 'Hi {{customer_name}}, when is a good time to discuss your quote? I can help finalize the details for {{move_date}}.'],
  ['Follow-Up 1: Reminder and Assistance', 'Hi {{customer_name}}, just following up on Quote {{quote_number}}. Let me know if you have questions or want to secure your move.'],
  ['Follow-Up 2: Emphasize Value', 'Hi {{customer_name}}, Kratos Moving can help make your move smooth and organized. Reply here if you want to review Quote {{quote_number}}.'],
  ['Follow-Up 3: Encouraging Action', 'Hi {{customer_name}}, final follow-up on Quote {{quote_number}}. Reply here if you would like us to keep helping with your move.'],
  ['Inventory Request: Smart Moving Inventory Section', 'Hi {{customer_name}}, can you send your inventory details for Quote {{quote_number}}? This helps us keep the estimate accurate.'],
  ['Deposit Fee', 'Hi {{customer_name}}, your deposit to secure the move is {{deposit_amount}}. You can review the quote here: {{portal_link}}'],
  ['Lead Lost', 'Hi {{customer_name}}, we will close your request for now. Reply anytime if you still need help from {{company_name}}.'],
  ['Review Request', 'Hi {{customer_name}}, thank you for choosing {{company_name}}. If you had a great experience, we would really appreciate a review.'],
  ['Unavailable - Move Request Decline', 'Hi {{customer_name}}, unfortunately we are unavailable for your requested move date. Reply if your date is flexible and we can check alternatives.'],
  ['Virtual Consultation Confirmation', 'Hi {{customer_name}}, your virtual consultation with {{company_name}} is confirmed. We will review your inventory and move details together.'],
  ['In Person Consultation Confirmation', 'Hi {{customer_name}}, your in-person consultation with {{company_name}} is confirmed. We will review your move details and answer questions.'],
  ['Dispatcher - Truck Issue Notice', 'Hi {{customer_name}}, dispatch is reviewing a truck issue for your move. We will update you shortly with next steps.'],
  ['Dispatcher - Post Move Noting', 'Hi {{customer_name}}, dispatch is completing post-move notes. Reply here if there is anything we should add.'],
].map(([name, body], index) => ({
  id: `builtin-sms-${index}`,
  name,
  channel: 'sms',
  trigger: 'sales',
  subject: null,
  body,
  is_active: true,
}))

function mergeTemplateLists(builtin: CommunicationTemplate[], loaded: CommunicationTemplate[]) {
  const byName = new Map<string, CommunicationTemplate>()
  for (const template of builtin) byName.set(template.name.toLowerCase(), template)
  for (const template of loaded) byName.set(template.name.toLowerCase(), template)
  return Array.from(byName.values())
}

function AddressBlock({ prefix, data }: { prefix: 'origin' | 'dest'; data: OppDetail }) {
  const isOrigin = prefix === 'origin'
  const addr1    = isOrigin ? data.origin_address_line1 : data.dest_address_line1
  const addr2    = isOrigin ? data.origin_address_line2 : data.dest_address_line2
  const city     = isOrigin ? data.origin_city          : data.dest_city
  const prov     = isOrigin ? data.origin_province      : data.dest_province
  const postal   = isOrigin ? data.origin_postal_code   : data.dest_postal_code
  const dwelling = isOrigin ? data.origin_dwelling_type : data.dest_dwelling_type
  const floor    = isOrigin ? data.origin_floor         : data.dest_floor
  const elevator = isOrigin ? data.origin_has_elevator  : data.dest_has_elevator
  const stairs   = isOrigin ? data.origin_stairs_count  : data.dest_stairs_count
  const longCarry= isOrigin ? data.origin_long_carry    : data.dest_long_carry
  const parking  = isOrigin ? data.origin_parking_notes : data.dest_parking_notes
  const hasAddress = addr1 || city
  if (!hasAddress) return <p className="text-sm text-slate-400">Not set</p>
  return (
    <div className="space-y-1 text-sm text-slate-700">
      {addr1 && <p>{addr1}</p>}
      {addr2 && <p>{addr2}</p>}
      {(city || prov || postal) && (
        <p>{[city, prov, postal].filter(Boolean).join(', ')}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {dwelling && <span className="capitalize">{dwelling.replace(/_/g,' ')}</span>}
        {floor != null && <span>Floor {floor}</span>}
        {elevator && <span>Elevator ✓</span>}
        {(stairs ?? 0) > 0 && <span>{stairs} stairs</span>}
        {longCarry && <span>Long carry ✓</span>}
      </div>
      {parking && <p className="mt-1 text-xs italic text-slate-500">{parking}</p>}
    </div>
  )
}

const COMM_TYPES = [
  { value: 'note',  label: 'Note',  icon: FileText },
  { value: 'email', label: 'Email', icon: AtSign },
  { value: 'call',  label: 'Call',  icon: PhoneCall },
  { value: 'sms',   label: 'Text',  icon: MessageSquare },
] as const

type CommType = typeof COMM_TYPES[number]['value']
type QuoteTab = 'sales' | 'estimate' | 'storage' | 'files' | 'accounting' | 'profitability'

const QUOTE_TABS: Array<{ value: QuoteTab; label: string }> = [
  { value: 'sales', label: 'Sales' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'storage', label: 'Storage' },
  { value: 'files', label: 'Files & Photos' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'profitability', label: 'Profitability' },
]

const CALL_OUTCOME_OPTIONS = [
  { value: 'no_answer',    label: 'No Answer' },
  { value: 'busy',         label: 'Busy' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'left_live_message', label: 'Left Live Message' },
  { value: 'voicemail', label: 'Left Voicemail' },
  { value: 'connected', label: 'Connected' },
  { value: 'number_disconnected', label: 'Number Disconnected' },
]

const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash', icon: Banknote, note: 'Record only' },
  { label: 'Check', value: 'check', icon: ReceiptText, note: 'Record only' },
  { label: 'Credit Card', value: 'credit_card', icon: CreditCard, note: 'Stripe Checkout or record only' },
  { label: 'Credit Card (Record Only)', value: 'credit_card_record', icon: CreditCard, note: 'Manual card record' },
  { label: 'Debit Card', value: 'debit_card', icon: CreditCard, note: 'Stripe Checkout or record only' },
  { label: 'Debit Card (Record Only)', value: 'debit_card_record', icon: CreditCard, note: 'Manual debit/card record' },
  { label: 'Interac e-Transfer', value: 'interac_e_transfer', icon: WalletCards, note: 'Record only' },
  { label: 'Wire Transfer', value: 'wire_transfer', icon: Landmark, note: 'Record only' },
] as const

type PaymentMethod = typeof PAYMENT_METHODS[number]['value']

const RECORD_ONLY_PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'check',
  'credit_card_record',
  'debit_card_record',
  'interac_e_transfer',
  'wire_transfer',
]

const STRIPE_PAYMENT_METHODS: PaymentMethod[] = ['credit_card', 'debit_card']

function CommTypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ElementType> = {
    note: FileText, call: PhoneCall, sms: MessageSquare, email: AtSign,
    follow_up: CalendarPlus, status: RefreshCw, status_change: RefreshCw,
    audit: CheckCircle2, create: FilePlus, status_changed: RefreshCw,
  }
  const Icon = icons[type] ?? FileText
  return <Icon size={14} className="shrink-0" />
}

import { templatesByChannel } from '@/lib/templates/follow-up-templates'
import { interpolate } from '@/lib/templates/interpolate'
const FOLLOW_UP_SMS_TEMPLATES   = templatesByChannel('sms')
const FOLLOW_UP_EMAIL_TEMPLATES = templatesByChannel('email')

export default function OpportunityDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [opp, setOpp] = useState<OppDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<QuoteTab>('sales')

  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showQuickEdit, setShowQuickEdit] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Move date inline edit
  const [showDateEdit, setShowDateEdit] = useState(false)
  const [editingDate, setEditingDate] = useState('')
  const [editingTbd, setEditingTbd] = useState(false)
  const [savingDate, setSavingDate] = useState(false)

  // Address edit modal
  const [addressEditData, setAddressEditData] = useState<EditAddressData | null>(null)

  // Charges
  const [charges, setCharges] = useState<OpportunityCharge[]>([])
  const [chargesLoading, setChargesLoading] = useState(false)
  const [chargePanelOpen, setChargePanelOpen] = useState(false)
  const [tariffPreFill, setTariffPreFill] = useState<Record<string, unknown> | null>(null)
  const [editingCharge, setEditingCharge] = useState<OpportunityCharge | null>(null)
  const [deletingChargeId, setDeletingChargeId] = useState<string | null>(null)

  // Trip data (distances between stops — fetched when estimate tab opens)
  const [tripData, setTripData] = useState<TravelEstimateResult | null>(null)
  const [tripDataLoading, setTripDataLoading] = useState(false)

  // SMS delivery status (fetched once)
  const [smsStatus, setSmsStatus] = useState<{ canSend: boolean; provider: string; reason?: string; recommendation?: string } | null>(null)
  const [smsStatusLoading, setSmsStatusLoading] = useState(false)

  // Communication composer
  const [commType, setCommType] = useState<CommType>('note')
  const [commBody, setCommBody] = useState('')
  const [commCallOutcome, setCommCallOutcome] = useState('')
  const [commDirection, setCommDirection] = useState<'outbound' | 'inbound'>('outbound')
  const [commSubject, setCommSubject] = useState('')
  const [commEmailTo, setCommEmailTo] = useState('')
  const [commEmailTplId, setCommEmailTplId] = useState('')
  const [commSmsTplId, setCommSmsTplId] = useState('')
  const [commSubmitting, setCommSubmitting] = useState(false)
  const [showCreateFollowUp, setShowCreateFollowUp] = useState(false)
  // Unified templates — email + SMS loaded once when Sales tab opens
  const [allTemplates, setAllTemplates] = useState<CommunicationTemplate[]>([])
  // Call tab follow-up template selectors + editable bodies
  const [callFollowUpSmsTplId, setCallFollowUpSmsTplId] = useState('')
  const [callFollowUpSmsBody, setCallFollowUpSmsBody] = useState('')
  const [callFollowUpEmailTplId, setCallFollowUpEmailTplId] = useState('')
  const [callFollowUpEmailSubject, setCallFollowUpEmailSubject] = useState('')
  const [callFollowUpEmailBody, setCallFollowUpEmailBody] = useState('')

  // Timeline + filters
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')

  // Notes (estimate tab)
  const [notes, setNotes] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [crewNotes, setCrewNotes] = useState('')
  const [dispatcherNotes, setDispatcherNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [savingNoteField, setSavingNoteField] = useState<string | null>(null)
  const [savingMoveSize, setSavingMoveSize] = useState(false)
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('received')
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [notesTab, setNotesTab] = useState<'internal' | 'customer' | 'crew' | 'dispatcher'>('internal')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/opportunities/${id}`)
      if (!res.ok) { setError('Quote not found'); return }
      const data: OppDetail = await res.json()
      setOpp(data)
      setNotes(data.notes ?? '')
      setCustomerNotes(data.customer_notes ?? '')
      setCrewNotes(data.crew_notes ?? '')
      setDispatcherNotes(data.dispatcher_notes ?? '')
    } catch { setError('Failed to load') }
    finally { setLoading(false) }
  }, [id])

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}/timeline`)
      if (res.ok) setTimeline(await res.json())
    } catch {}
    finally { setTimelineLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (tab !== 'sales') return
    loadTimeline()
    if (!smsStatus && !smsStatusLoading) {
      setSmsStatusLoading(true)
      fetch('/api/admin/sms/status')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setSmsStatus(d) })
        .catch(() => {})
        .finally(() => setSmsStatusLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loadTimeline])

  // Load all templates (email + SMS) once when Sales tab opens
  useEffect(() => {
    if (tab !== 'sales' || allTemplates.length > 0) return
    fetch('/api/admin/communication-templates')
      .then(r => r.json())
      .then(d => setAllTemplates(d.templates ?? []))
      .catch(() => {})
  }, [tab, allTemplates.length])

  async function saveNoteField(
    field: 'notes' | 'customer_notes' | 'crew_notes' | 'dispatcher_notes',
    value: string,
  ) {
    if (!opp || value === (opp[field] ?? '')) return
    setNotesSaving(true)
    setSavingNoteField(field)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'Failed to save notes')
        return
      }
      setOpp(p => p ? { ...p, [field]: value } : p)
      toast.success('Notes saved.')
    } finally {
      setNotesSaving(false)
      setSavingNoteField(null)
    }
  }

  function saveNotes() {
    void saveNoteField('notes', notes)
  }

  async function saveMoveSize(value: string) {
    if (!opp || value === (opp.move_size ?? '')) return
    setSavingMoveSize(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move_size: value || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to update move size')
        return
      }
      setOpp(p => p ? { ...p, move_size: value || null } : p)
      toast.success('Move size updated.')
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSavingMoveSize(false)
    }
  }

  function openDateEdit() {
    if (!opp) return
    setEditingDate(opp.service_date ?? '')
    setEditingTbd(!opp.service_date)
    setShowDateEdit(true)
  }

  async function saveDateEdit() {
    if (!opp) return
    setSavingDate(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}/move-date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceDate: editingTbd ? null : editingDate, tbd: editingTbd }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to save date'); return }
      setOpp(p => p ? { ...p, service_date: json.service_date } : p)
      setShowDateEdit(false)
      toast.success('Move date updated.')
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSavingDate(false)
    }
  }

  function openAddressEdit(prefix: 'origin' | 'dest') {
    if (!opp) return
    const isOrigin = prefix === 'origin'
    setAddressEditData({
      oppId:          opp.id,
      prefix,
      address_line1:  (isOrigin ? opp.origin_address_line1 : opp.dest_address_line1)  ?? '',
      address_line2:  (isOrigin ? opp.origin_address_line2 : opp.dest_address_line2)  ?? '',
      city:           (isOrigin ? opp.origin_city          : opp.dest_city)            ?? '',
      province:       (isOrigin ? opp.origin_province      : opp.dest_province)        ?? '',
      postal_code:    (isOrigin ? opp.origin_postal_code   : opp.dest_postal_code)     ?? '',
      place_id:       '',
      dwelling_type:  (isOrigin ? opp.origin_dwelling_type : opp.dest_dwelling_type)   ?? '',
      floor:          String(isOrigin ? (opp.origin_floor ?? '') : (opp.dest_floor ?? '')),
      has_elevator:   (isOrigin ? opp.origin_has_elevator  : opp.dest_has_elevator)    ?? false,
      stairs_count:   String(isOrigin ? (opp.origin_stairs_count ?? '') : (opp.dest_stairs_count ?? '')),
      long_carry:     (isOrigin ? opp.origin_long_carry    : opp.dest_long_carry)      ?? false,
      parking_notes:  (isOrigin ? opp.origin_parking_notes : opp.dest_parking_notes)   ?? '',
    })
  }

  const fetchCharges = useCallback(async () => {
    setChargesLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}/charges`)
      if (res.ok) setCharges(await res.json())
    } catch {}
    finally { setChargesLoading(false) }
  }, [id])

  const fetchTripData = useCallback(async () => {
    setTripDataLoading(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}/travel-estimate`, { cache: 'no-store' })
      if (res.ok) setTripData(await res.json())
    } catch {}
    finally { setTripDataLoading(false) }
  }, [id])

  useEffect(() => {
    if (tab === 'estimate') {
      fetchCharges()
      fetchTripData()
    }
  }, [tab, fetchCharges, fetchTripData])

  async function deleteCharge(chargeId: string) {
    setDeletingChargeId(chargeId)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}/charges/${chargeId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'Failed to delete charge')
        return
      }
      toast.success('Charge removed.')
      await fetchCharges()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setDeletingChargeId(null)
    }
  }

  async function duplicateCharge(charge: OpportunityCharge) {
    if (charge.charge_type === 'moving_labor') return
    try {
      const res = await fetch(`/api/admin/opportunities/${id}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charge_type: charge.charge_type,
          name: `${charge.name} Copy`,
          description: charge.description,
          config: charge.config,
          subtotal: charge.subtotal,
          discount_type: charge.discount_type,
          discount_value: charge.discount_value,
          discount_amount: charge.discount_amount,
          total: charge.total,
          is_overridden: charge.is_overridden,
          override_reason: charge.override_reason,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to duplicate charge')
        return
      }
      toast.success('Charge duplicated.')
      await fetchCharges()
    } catch {
      toast.error('Network error — please try again')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === 'string' ? json.error : 'Delete failed')
        return
      }
      toast.success('Quote deleted')
      router.replace('/admin/opportunities')
      router.refresh()
    } finally { setDeleting(false) }
  }

  async function submitComm() {
    // validate client-side: for calls, require a call outcome; for others require a body
    if (commType === 'call' && !commCallOutcome) { toast.error('Select a call outcome'); return }
    if (commType !== 'call' && !commBody.trim()) { toast.error('Enter content'); return }
    setCommSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        opportunity_id: id,
        type: commType,
        body: commBody,
      }
      if (commType === 'call') {
        payload.call_outcome = commCallOutcome || null
        payload.direction = commDirection
      }
      if (commType === 'email') {
        payload.subject  = commSubject || null
        payload.email_to = commEmailTo || null
        payload.direction = 'outbound'
      }
      if (commType === 'note') payload.direction = 'internal'
      if (commType === 'sms')  payload.direction = 'outbound'

      const res = await fetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { toast.error('Failed to save'); return }
      if (commType === 'note') toast.success('Note saved')
      else if (commType === 'call') toast.success('Call logged.')
      else toast.success(`${commType.toUpperCase()} logged`)
      setCommBody('')
      setCommCallOutcome('')
      setCommSubject('')
      setCommEmailTo('')
      loadTimeline()
    } catch { toast.error('Network error') }
    finally { setCommSubmitting(false) }
  }

  async function sendSmsDirectly() {
    if (!opp || !commBody.trim()) { toast.error('Enter message content'); return }
    setCommSubmitting(true)
    try {
      const res = await fetch('/api/communications/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: id,
          customerId: opp.customer?.id ?? null,
          toPhoneNumber: opp.customer?.phone ?? null,
          messageBody: commBody.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json.error ?? 'SMS send failed'
        toast.error(msg)
        loadTimeline()
      } else {
        toast.success('SMS sent.')
        setCommBody('')
        setCommSmsTplId('')
        loadTimeline()
      }
    } catch { toast.error('Network error') }
    finally { setCommSubmitting(false) }
  }

  async function sendEmailDirectly() {
    if (!opp || !commBody.trim()) { toast.error('Enter email content'); return }
    setCommSubmitting(true)
    try {
      const res = await fetch('/api/communications/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: id,
          customerId: opp.customer?.id ?? null,
          toEmail: commEmailTo || opp.customer?.email || null,
          subject: commSubject || 'Kratos Moving follow-up',
          messageBody: commBody.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'Email send failed')
        loadTimeline()
      } else {
        toast.success('Email sent.')
        setCommBody('')
        setCommSubject('')
        setCommEmailTo('')
        setCommEmailTplId('')
        loadTimeline()
      }
    } catch { toast.error('Network error') }
    finally { setCommSubmitting(false) }
  }

  async function logSmsOnly() {
    if (!opp || !commBody.trim()) { toast.error('Enter message content'); return }
    setCommSubmitting(true)
    try {
      const res = await fetch('/api/admin/sms/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: id,
          customerId: opp.customer?.id ?? null,
          body: commBody.trim(),
        }),
      })
      if (!res.ok) { toast.error('Failed to log SMS'); return }
      toast.success('SMS logged (not sent).')
      setCommBody('')
      loadTimeline()
    } catch { toast.error('Network error') }
    finally { setCommSubmitting(false) }
  }

  // Populate editable SMS body when template is picked
  useEffect(() => {
    if (!callFollowUpSmsTplId || !opp) { setCallFollowUpSmsBody(''); return }
    const tpl = FOLLOW_UP_SMS_TEMPLATES.find(t => t.id === callFollowUpSmsTplId)
    if (!tpl) return
    setCallFollowUpSmsBody(interpolate(tpl.body, {
      customer: { full_name: opp.customer?.full_name ?? '' },
      opportunity: { opportunity_number: opp.opportunity_number, service_date: opp.service_date, move_size: opp.move_size },
      agent: { full_name: opp.agent?.full_name ?? '' },
    }))
  }, [callFollowUpSmsTplId, opp])

  // Populate editable email subject + body when template is picked
  useEffect(() => {
    if (!callFollowUpEmailTplId || !opp) { setCallFollowUpEmailSubject(''); setCallFollowUpEmailBody(''); return }
    const tpl = FOLLOW_UP_EMAIL_TEMPLATES.find(t => t.id === callFollowUpEmailTplId)
    if (!tpl) return
    const ctx = {
      customer: { full_name: opp.customer?.full_name ?? '' },
      opportunity: { opportunity_number: opp.opportunity_number, service_date: opp.service_date, move_size: opp.move_size },
      agent: { full_name: opp.agent?.full_name ?? '' },
    }
    setCallFollowUpEmailSubject(interpolate(tpl.subject ?? '', ctx))
    setCallFollowUpEmailBody(interpolate(tpl.body, ctx))
  }, [callFollowUpEmailTplId, opp])

  async function submitCallWithFollowUp() {
    if (!opp) return
    if (!commCallOutcome) { toast.error('Select a call outcome'); return }
    setCommSubmitting(true)
    try {
      const res = await fetch(`/api/admin/opportunities/${id}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction:            commDirection,
          outcome:              commCallOutcome,
          description:          commBody.trim() || null,
          sms_template_id:      callFollowUpSmsTplId || null,
          sms_body_override:    callFollowUpSmsBody.trim() || null,
          email_template_id:    callFollowUpEmailTplId || null,
          email_subject_override: callFollowUpEmailSubject.trim() || null,
          email_body_override:  callFollowUpEmailBody.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === 'string' ? json.error : 'Failed to log call')
        return
      }
      if (json.errors?.length) {
        // Call was logged but follow-up sends had partial failures
        toast.warning(`Call logged. Follow-up issues: ${(json.errors as string[]).join(' · ')}`)
      } else {
        const parts = ['Call logged']
        if (json.created?.sms) parts.push('SMS sent')
        if (json.created?.email) parts.push('email sent')
        toast.success(parts.join(' · ') + '.')
      }
      setCommBody('')
      setCommCallOutcome('')
      setCallFollowUpSmsTplId('')
      setCallFollowUpSmsBody('')
      setCallFollowUpEmailTplId('')
      setCallFollowUpEmailSubject('')
      setCallFollowUpEmailBody('')
      loadTimeline()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setCommSubmitting(false)
    }
  }

  function selectPaymentMethod(method: PaymentMethod) {
    setSelectedPaymentMethod(current => current === method ? null : method)
    setPaymentMessage(null)
    if (!paymentAmount && opp?.total_amount && opp.total_amount > 0) {
      setPaymentAmount(String(opp.total_amount))
    }
  }

  async function startStripeCheckout() {
    if (!opp || !selectedPaymentMethod) return
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentMessage('Enter an amount before starting Stripe Checkout.')
      return
    }

    setPaymentLoading(true)
    setPaymentMessage(null)
    try {
      const res = await fetch('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opp.id,
          customerId: opp.customer?.id ?? null,
          amountCents: Math.round(amount * 100),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setPaymentMessage(data.error ?? 'Unable to create Stripe Checkout session.')
        return
      }

      if (data.url) window.location.href = data.url
    } catch {
      setPaymentMessage('Unable to reach the payment server.')
    } finally {
      setPaymentLoading(false)
    }
  }

  async function recordPayment(methodOverride?: PaymentMethod) {
    if (!opp) return
    const method = methodOverride ?? selectedPaymentMethod
    if (!method) return

    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentMessage('Enter an amount before recording payment.')
      return
    }

    setPaymentLoading(true)
    setPaymentMessage(null)
    try {
      const res = await fetch('/api/payments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opp.id,
          customerId: opp.customer?.id ?? null,
          paymentMethod: method === 'credit_card' ? 'credit_card_record' : method === 'debit_card' ? 'debit_card_record' : method,
          amount,
          paymentDate,
          referenceNumber: paymentReference,
          notes: paymentNotes,
          status: paymentStatus,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setPaymentMessage(data.error ?? 'Unable to record payment.')
        return
      }

      toast.success('Payment recorded')
      setPaymentDrawerOpen(false)
      setSelectedPaymentMethod(null)
      setPaymentAmount('')
      setPaymentReference('')
      setPaymentNotes('')
      setPaymentStatus('received')
      loadTimeline()
    } catch {
      setPaymentMessage('Unable to reach the payment server.')
    } finally {
      setPaymentLoading(false)
    }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="h-16 rounded-xl bg-slate-200" />
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  )

  if (error || !opp) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-sm font-medium text-slate-500">{error ?? 'Not found'}</p>
      <Link href={`/admin/opportunities/${id}`} className="mt-4 text-sm text-kratos hover:underline">← Back to Quote</Link>
    </div>
  )

  const chargeTotals = calculateEstimate(charges, 0.13, false)
  const subtotal = chargeTotals.subtotal
  const discounts = chargeTotals.total_discounts
  const salesTax = chargeTotals.sales_tax
  const estimateTotal = chargeTotals.estimate_total
  const totalPaid = 0
  const balanceDue = Math.max(estimateTotal - totalPaid, 0)
  const profit = opp.total_amount - opp.estimated_cost
  const selectedPaymentConfig = PAYMENT_METHODS.find(method => method.value === selectedPaymentMethod)
  const selectedIsRecordOnly = selectedPaymentMethod ? RECORD_ONLY_PAYMENT_METHODS.includes(selectedPaymentMethod) : false
  const selectedSupportsStripe = selectedPaymentMethod ? STRIPE_PAYMENT_METHODS.includes(selectedPaymentMethod) : false

  // Timeline stats
  const callCount     = timeline.filter(t => t._kind === 'communication' && t.type === 'call').length
  const noteCount     = timeline.filter(t => t._kind === 'communication' && t.type === 'note').length
  const emailCount    = timeline.filter(t => t._kind === 'communication' && t.type === 'email').length
  const smsCount      = timeline.filter(t => t._kind === 'communication' && t.type === 'sms').length
  const followUpCount = timeline.filter(t => t._kind === 'follow_up').length
  const daysUntilMove = getDaysUntilMove(opp.service_date)

  const filteredTimeline = timeline.filter(item => {
    if (activityFilter === 'all') return true
    if (activityFilter === 'notes')     return item._kind === 'communication' && item.type === 'note'
    if (activityFilter === 'emails')    return item._kind === 'communication' && item.type === 'email'
    if (activityFilter === 'calls')     return item._kind === 'communication' && item.type === 'call'
    if (activityFilter === 'texts')     return item._kind === 'communication' && item.type === 'sms'
    if (activityFilter === 'follow_ups') return item._kind === 'follow_up'
    return true
  })

  return (
    <>
      <div className="space-y-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/admin/customers" className="hover:text-slate-800">Customer Profiles</Link>
          <ChevronRight size={14} />
          <Link href={opp.customer ? `/admin/customers/${opp.customer.id}` : `/admin/opportunities/${id}`} className="hover:text-slate-800">{opp.customer?.full_name ?? 'Profile'}</Link>
          <ChevronRight size={14} />
          <span className="font-mono font-medium text-slate-700">Quote {formatQuoteNumber(opp.opportunity_number)}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {opp.customer?.full_name ?? 'Unknown Customer'}
              </h1>
              <button
                onClick={() => setShowQuickEdit(true)}
                className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                title="Edit contact info"
                aria-label="Edit customer"
              >
                <Pencil size={14} />
              </button>
              <StatusPill status={opp.status} />
            </div>

            {/* Contact row — phone + email directly under the name */}
            {(opp.customer?.phone || opp.customer?.email) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {opp.customer?.phone && (
                  <a
                    href={`tel:${opp.customer.phone}`}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
                  >
                    <Phone size={13} className="text-slate-400" />
                    <span>{opp.customer.phone.replace(/\D/g,'').slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}</span>
                    {opp.customer.phone_type && (
                      <span className="text-xs text-slate-400 capitalize">({opp.customer.phone_type})</span>
                    )}
                  </a>
                )}
                {opp.customer?.phone && opp.customer?.email && (
                  <span className="text-slate-300 select-none">·</span>
                )}
                {opp.customer?.email && (
                  <a
                    href={`mailto:${opp.customer.email}`}
                    className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
                  >
                    <Mail size={13} className="text-slate-400" />
                    <span>{opp.customer.email}</span>
                  </a>
                )}
              </div>
            )}

            <p className="mt-1 text-sm text-slate-500">
              {SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type}
              {opp.service_date ? ` · ${formatDateShort(opp.service_date)}` : ' · TBD'}
              {opp.move_size ? ` · ${MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g,' ')}` : ''}
              {' · '}Quote {formatQuoteNumber(opp.opportunity_number)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SendEstimateMenu
              opportunity={{
                id: opp.id,
                opportunityNumber: formatQuoteNumber(opp.opportunity_number),
                estimateTotal: estimateTotal,
                depositAmount: opp.deposit_amount ?? null,
                moveSize: opp.move_size ? (MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g,' ')) : null,
                moveDate: opp.service_date ? formatDateShort(opp.service_date) : null,
                customer: opp.customer ? {
                  id: opp.customer.id,
                  fullName: opp.customer.full_name,
                  email: opp.customer.email,
                  phone: opp.customer.phone,
                } : null,
              }}
            />
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Status
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {QUOTE_TABS.filter(t => t.value !== 'profitability' || opp.can_view_profitability).map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'whitespace-nowrap px-5 py-2.5 text-sm font-medium transition-colors',
                tab === t.value
                  ? 'border-b-2 border-kratos text-slate-900'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── SALES TAB ── */}
        {tab === 'sales' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Left: composer + timeline */}
            <div className="space-y-4 lg:col-span-2">

              {/* Communication composer */}
              {(() => {
                const emailTpls = mergeTemplateLists(BUILTIN_EMAIL_TEMPLATES, allTemplates.filter(t => t.channel === 'email' && t.is_active))
                const smsTpls   = mergeTemplateLists(BUILTIN_SMS_TEMPLATES, allTemplates.filter(t => t.channel === 'sms' && t.is_active))

                // Template select component — renders a <select> that applies merge fields on change
                const TplSelect = ({
                  templates,
                  value,
                  onChange,
                  placeholder,
                  fillSubject,
                }: {
                  templates: CommunicationTemplate[]
                  value: string
                  onChange: (id: string) => void
                  placeholder: string
                  fillSubject?: boolean
                }) => (
                  <select
                    value={value}
                    onChange={e => {
                      const tpl = templates.find(t => t.id === e.target.value)
                      if (tpl) {
                        setCommBody(applyMerge(tpl.body, opp))
                        if (fillSubject && tpl.subject) setCommSubject(applyMerge(tpl.subject, opp))
                      } else {
                        setCommBody('')
                        if (fillSubject) setCommSubject('')
                      }
                      onChange(e.target.value)
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-kratos"
                  >
                    <option value="">{placeholder}</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )

                return (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-base font-bold tracking-tight text-slate-900">
                          Sales &mdash; {formatQuoteNumber(opp.opportunity_number)}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setShowCreateFollowUp(true)}
                          className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-kratos hover:bg-kratos/5 hover:text-slate-900 transition-colors"
                        >
                          <CalendarPlus size={11} className="text-kratos" />
                          Create Follow-up
                        </button>
                      </div>
                    </div>

                    {/* Tab row — clean underline style */}
                    <div className="flex border-b border-slate-200">
                      {COMM_TYPES.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setCommType(value)
                            setCommBody('')
                            setCommSubject('')
                            setCommEmailTplId('')
                            setCommSmsTplId('')
                          }}
                          className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 px-2 py-3 text-sm font-medium border-b-2 transition-all',
                            commType === value
                              ? 'border-kratos text-slate-900'
                              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
                          )}
                        >
                          <Icon size={14} /> {label}
                        </button>
                      ))}
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-3">

                      {/* ── NOTE TAB ── */}
                      {commType === 'note' && (
                        <textarea
                          rows={5}
                          value={commBody}
                          onChange={e => setCommBody(e.target.value)}
                          placeholder="Write a note…"
                          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                        />
                      )}

                      {/* ── EMAIL TAB ── */}
                      {commType === 'email' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={commEmailTo}
                              onChange={e => setCommEmailTo(e.target.value)}
                              placeholder={opp.customer?.email ?? 'To: customer@example.com'}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                            />
                            <TplSelect
                              templates={emailTpls}
                              value={commEmailTplId}
                              onChange={setCommEmailTplId}
                              placeholder="— Email Template —"
                              fillSubject
                            />
                          </div>
                          <input
                            value={commSubject}
                            onChange={e => setCommSubject(e.target.value)}
                            placeholder="Subject"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                          />
                          <textarea
                            rows={6}
                            value={commBody}
                            onChange={e => setCommBody(e.target.value)}
                            placeholder="Email body…"
                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                          />
                          <p className="text-xs text-slate-400">
                            Email sends through Resend and is added to the activity history only after the server accepts it.
                          </p>
                        </>
                      )}

                      {/* ── CALL TAB ── */}
                      {commType === 'call' && (() => {
                        const showFollowUp = ['no_answer', 'busy', 'voicemail'].includes(commCallOutcome)
                        const dropdownCls = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-kratos disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'
                        return (
                          <>
                            {/* All controls inline in one row */}
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={commDirection}
                                onChange={e => setCommDirection(e.target.value as 'outbound' | 'inbound')}
                                className={dropdownCls}
                              >
                                <option value="outbound">Outbound</option>
                                <option value="inbound">Inbound</option>
                              </select>
                              <select
                                value={commCallOutcome}
                                onChange={e => {
                                  setCommCallOutcome(e.target.value)
                                  setCallFollowUpSmsTplId('')
                                  setCallFollowUpSmsBody('')
                                  setCallFollowUpEmailTplId('')
                                  setCallFollowUpEmailSubject('')
                                  setCallFollowUpEmailBody('')
                                }}
                                className={dropdownCls}
                              >
                                <option value="">— Outcome —</option>
                                {CALL_OUTCOME_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>

                              {/* Follow-up template pickers — inline, only for non-connected outcomes */}
                              {showFollowUp && (
                                <>
                                  <select
                                    value={callFollowUpSmsTplId}
                                    onChange={e => setCallFollowUpSmsTplId(e.target.value)}
                                    disabled={!opp?.customer?.phone}
                                    title={opp?.customer?.phone ? 'Pick an SMS template to send after logging' : 'Customer has no phone number'}
                                    className={dropdownCls}
                                  >
                                    <option value="">{opp?.customer?.phone ? 'Send a Text' : 'Send a Text (no phone on file)'}</option>
                                    {FOLLOW_UP_SMS_TEMPLATES.map(t => (
                                      <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={callFollowUpEmailTplId}
                                    onChange={e => setCallFollowUpEmailTplId(e.target.value)}
                                    disabled={!opp?.customer?.email}
                                    title={opp?.customer?.email ? 'Pick an email template to send after logging' : 'Customer has no email address'}
                                    className={dropdownCls}
                                  >
                                    <option value="">{opp?.customer?.email ? 'Send an Email' : 'Send an Email (no email on file)'}</option>
                                    {FOLLOW_UP_EMAIL_TEMPLATES.map(t => (
                                      <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                  </select>
                                </>
                              )}

                              <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                                <span>Today</span>
                                <Clock size={12} />
                                <span>{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                              </div>
                            </div>

                            {/* Editable SMS body — only when SMS template is picked */}
                            {showFollowUp && callFollowUpSmsTplId && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  SMS to send — edit before logging
                                </p>
                                <textarea
                                  rows={4}
                                  value={callFollowUpSmsBody}
                                  onChange={e => setCallFollowUpSmsBody(e.target.value)}
                                  placeholder="SMS body…"
                                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                                />
                                <p className="mt-0.5 text-xs text-slate-400">{callFollowUpSmsBody.length} chars · to {opp?.customer?.phone}</p>
                              </div>
                            )}

                            {/* Editable email subject + body — only when email template is picked */}
                            {showFollowUp && callFollowUpEmailTplId && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Email to send — edit before logging
                                </p>
                                <input
                                  type="text"
                                  value={callFollowUpEmailSubject}
                                  onChange={e => setCallFollowUpEmailSubject(e.target.value)}
                                  placeholder="Subject…"
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                                />
                                <textarea
                                  rows={5}
                                  value={callFollowUpEmailBody}
                                  onChange={e => setCallFollowUpEmailBody(e.target.value)}
                                  placeholder="Email body…"
                                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                                />
                                <p className="text-xs text-slate-400">to {opp?.customer?.email}</p>
                              </div>
                            )}

                            {/* Call notes textarea — shown when no SMS/email editor is active */}
                            {!(showFollowUp && (callFollowUpSmsTplId || callFollowUpEmailTplId)) && (
                              <textarea
                                rows={4}
                                value={commBody}
                                onChange={e => setCommBody(e.target.value)}
                                placeholder={commCallOutcome === 'connected' ? 'Describe the call…' : 'Notes (optional — auto-filled if blank)'}
                                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                              />
                            )}
                          </>
                        )
                      })()}

                      {/* ── TEXT TAB ── */}
                      {commType === 'sms' && (
                        <>
                          <TplSelect
                            templates={smsTpls}
                            value={commSmsTplId}
                            onChange={setCommSmsTplId}
                            placeholder="— SMS Template —"
                          />
                          <textarea
                            rows={5}
                            value={commBody}
                            onChange={e => setCommBody(e.target.value)}
                            placeholder="Message content…"
                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
                          />
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">{commBody.length} characters</span>
                            {commBody.length > 160 && (
                              <span className="text-amber-600">Long message — may send as {Math.ceil(commBody.length / 153)} SMS segments</span>
                            )}
                          </div>
                          {!smsStatus?.canSend && !smsStatusLoading && (
                            <p className="text-xs text-amber-700 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                              SMS sending is not connected. You can still log the message.
                            </p>
                          )}
                        </>
                      )}

                      {/* ── Footer ── */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={showCreateFollowUp}
                              onChange={e => { if (e.target.checked) setShowCreateFollowUp(true) }}
                              className="h-4 w-4 rounded border-slate-300 accent-kratos"
                            />
                            Create a follow-up
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                            <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 accent-kratos" />
                            Turn off conversation replies in-app
                          </label>
                        </div>

                        {commType === 'sms' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={logSmsOnly}
                              disabled={commSubmitting || !commBody.trim()}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {commSubmitting && <Loader2 size={13} className="animate-spin" />}
                              Log Only
                            </button>
                            <button
                              onClick={sendSmsDirectly}
                              disabled={commSubmitting || !commBody.trim()}
                              title={!smsStatus?.canSend ? (smsStatus?.reason ?? 'SMS delivery not configured') : undefined}
                              className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {commSubmitting && <Loader2 size={14} className="animate-spin" />}
                              Send SMS
                            </button>
                          </div>
                        ) : commType === 'email' ? (
                          <button
                            onClick={sendEmailDirectly}
                            disabled={commSubmitting || !commBody.trim()}
                            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {commSubmitting && <Loader2 size={14} className="animate-spin" />}
                            Send Email
                          </button>
                        ) : commType === 'call' ? (
                          <button
                            onClick={submitCallWithFollowUp}
                            disabled={commSubmitting || !commCallOutcome}
                            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
                          >
                            {commSubmitting && <Loader2 size={14} className="animate-spin" />}
                            Log Call
                          </button>
                        ) : (
                          <button
                            onClick={submitComm}
                            disabled={commSubmitting || !commBody.trim()}
                            className="flex items-center gap-2 rounded-lg bg-kratos px-5 py-2 text-sm font-semibold text-slate-900 hover:opacity-90 disabled:opacity-50"
                          >
                            {commSubmitting && <Loader2 size={14} className="animate-spin" />}
                            Add Note
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Stats row — compact single line below composer */}
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                {[
                  { icon: PhoneCall,    count: callCount,     label: 'Calls' },
                  { icon: MessageSquare, count: smsCount,      label: 'Texts' },
                  { icon: AtSign,       count: emailCount,    label: 'Emails' },
                  { icon: FileText,     count: noteCount,     label: 'Notes' },
                  { icon: CalendarPlus, count: followUpCount, label: 'Follow-ups' },
                ].map(({ icon: Icon, count, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-slate-600">
                    <Icon size={13} className="text-slate-400" />
                    <span className="font-semibold text-slate-900">{count}</span>
                    <span className="text-slate-400 text-xs">{label}</span>
                  </span>
                ))}
                <span className={cn(
                  'flex items-center gap-1.5',
                  !daysUntilMove || daysUntilMove === 'Move passed' ? 'text-slate-400'
                  : daysUntilMove === 'Today' || daysUntilMove === 'Tomorrow' ? 'text-amber-700'
                  : 'text-slate-600',
                )}>
                  <Calendar size={13} className="text-slate-400" />
                  <span className="font-semibold text-xs">
                    {!daysUntilMove ? '—'
                      : daysUntilMove === 'Move passed' ? 'Passed'
                      : daysUntilMove === 'Today' ? 'Today'
                      : daysUntilMove === 'Tomorrow' ? 'Tomorrow'
                      : daysUntilMove}
                  </span>
                  <span className="text-slate-400 text-xs">Until Move</span>
                </span>
              </div>

              {showCreateFollowUp && (
                <CreateFollowUpModal
                  opportunityId={opp.id}
                  customerId={opp.customer?.id}
                  defaultNotes={
                    commType === 'call' && (commCallOutcome === 'no_answer' || commCallOutcome === 'busy')
                      ? `Call back ${opp.customer?.full_name ?? 'customer'} — ${CALL_OUTCOMES[commCallOutcome].toLowerCase()}`
                      : commType === 'email'
                      ? `Follow up on estimate email with ${opp.customer?.full_name ?? 'customer'}`
                      : `Follow up with ${opp.customer?.full_name ?? 'customer'}`
                  }
                  defaultType={commType === 'call' ? 'call' : commType === 'sms' ? 'sms' : commType === 'email' ? 'email' : 'call'}
                  onClose={() => { setShowCreateFollowUp(false); loadTimeline() }}
                />
              )}

              {/* Activity timeline */}
              <div className="rounded-xl border border-slate-200 bg-white">
                {/* Header + filter tabs */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 pt-4">
                  <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Activity</h2>
                  <div className="flex items-center gap-0.5 pb-0">
                    {([ 'all', 'notes', 'calls', 'texts', 'emails', 'follow_ups' ] as ActivityFilter[]).map(f => {
                      const labels: Record<ActivityFilter, string> = {
                        all: 'All', notes: 'Notes', calls: 'Calls',
                        texts: 'Texts', emails: 'Emails', follow_ups: 'Follow-ups',
                      }
                      return (
                        <button
                          key={f}
                          onClick={() => setActivityFilter(f)}
                          className={cn(
                            'px-2.5 py-2 text-xs font-medium transition-colors',
                            activityFilter === f
                              ? 'border-b-2 border-kratos text-slate-900'
                              : 'text-slate-400 hover:text-slate-700',
                          )}
                        >
                          {labels[f]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="p-5">
                  {timelineLoading ? (
                    <div className="space-y-4 animate-pulse">
                      {[0,1,2].map(i => (
                        <div key={i} className="flex gap-3">
                          <div className="h-6 w-6 rounded-full bg-slate-100 shrink-0" />
                          <div className="flex-1 space-y-1">
                            <div className="h-3 w-1/3 rounded bg-slate-100" />
                            <div className="h-3 w-2/3 rounded bg-slate-100" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredTimeline.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      {activityFilter === 'all'
                        ? 'No activity yet — log a note, call, text, or email above.'
                        : `No ${activityFilter.replace('_', '-')} yet.`}
                    </p>
                  ) : (() => {
                    const showUpcoming = activityFilter === 'all' || activityFilter === 'follow_ups'
                    const upcomingItems = showUpcoming
                      ? filteredTimeline.filter(item => item._kind === 'follow_up' && !item.completed_at)
                      : []
                    const pastItems = (showUpcoming
                      ? filteredTimeline.filter(item => !(item._kind === 'follow_up' && !item.completed_at))
                      : filteredTimeline
                    ).filter(item => !(item._kind === 'audit' && item.action === 'update'))

                    const monthGroups: { month: string; items: TimelineItem[] }[] = []
                    for (const item of pastItems) {
                      const month = getMonthLabel(item.created_at)
                      const last = monthGroups[monthGroups.length - 1]
                      if (last?.month === month) last.items.push(item)
                      else monthGroups.push({ month, items: [item] })
                    }

                    const ACTIVITY_ICON_CONFIG: Record<string, { label: string; colorClass: string }> = {
                      note:           { label: 'Note',            colorClass: 'text-amber-600 bg-amber-50' },
                      sms_outbound:   { label: 'Outgoing SMS',    colorClass: 'text-purple-600 bg-purple-50' },
                      sms_inbound:    { label: 'Incoming SMS',    colorClass: 'text-indigo-600 bg-indigo-50' },
                      sms:            { label: 'SMS',             colorClass: 'text-purple-600 bg-purple-50' },
                      email_outbound: { label: 'Email Sent',      colorClass: 'text-blue-600 bg-blue-50' },
                      email_inbound:  { label: 'Email Received',  colorClass: 'text-cyan-600 bg-cyan-50' },
                      email:          { label: 'Email',           colorClass: 'text-blue-600 bg-blue-50' },
                      call_outbound:  { label: 'Outbound Call',   colorClass: 'text-green-600 bg-green-50' },
                      call_inbound:   { label: 'Inbound Call',    colorClass: 'text-emerald-600 bg-emerald-50' },
                      call:           { label: 'Call',            colorClass: 'text-green-600 bg-green-50' },
                      follow_up:      { label: 'Follow-up',       colorClass: 'text-orange-600 bg-orange-50' },
                      create:         { label: 'Quote created',   colorClass: 'text-orange-600 bg-orange-50' },
                      status_change:  { label: 'Status changed',  colorClass: 'text-slate-600 bg-slate-100' },
                    }

                    const renderItem = (item: TimelineItem) => {
                      const isAudit = item._kind === 'audit'
                      const isFu    = item._kind === 'follow_up'
                      const rawType = item.type ?? 'note'
                      const dir     = item.direction
                      const typeKey = isFu
                        ? 'follow_up'
                        : isAudit
                        ? (item.action ?? 'create')
                        : (dir && dir !== 'internal')
                          ? `${rawType}_${dir}`
                          : rawType
                      const cfg = ACTIVITY_ICON_CONFIG[typeKey] ?? ACTIVITY_ICON_CONFIG[rawType] ?? { label: rawType, colorClass: 'text-slate-500 bg-slate-100' }

                      return (
                        <article
                          key={item.id}
                          className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
                        >
                          {/* Card header */}
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                                cfg.colorClass,
                              )}>
                                <CommTypeIcon type={isFu ? 'follow_up' : isAudit ? (item.action === 'status_change' ? 'status' : 'audit') : rawType} />
                              </span>
                              <div className="min-w-0">
                                <span className="text-sm font-semibold text-slate-800">
                                  {isAudit
                                    ? (item.action === 'create' ? 'Quote created' : 'Status changed')
                                    : isFu
                                    ? `${(item.type ?? 'Follow-up').replace(/_/g,' ')} follow-up`
                                    : cfg.label}
                                </span>
                                {item.actor && (
                                  <span className="ml-1.5 text-xs text-slate-400">by {item.actor}</span>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 text-xs text-slate-400">{formatDatetime(item.created_at)}</span>
                          </div>

                          {/* Card body */}
                          {item._kind === 'communication' && (
                            <div className="pl-9">
                              {item.call_outcome && (
                                <p className="text-xs text-slate-500 mb-1">
                                  Outcome: {CALL_OUTCOMES[item.call_outcome] ?? item.call_outcome}
                                </p>
                              )}
                              {item.subject && (
                                <p className="text-sm font-medium text-slate-700 mb-1">{item.subject}</p>
                              )}
                              {item.body && (
                                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{item.body}</p>
                              )}
                            </div>
                          )}

                          {item._kind === 'follow_up' && (
                            <div className="pl-9 space-y-0.5">
                              <p className="text-sm text-slate-700">
                                Due {item.follow_up_date}
                                {item.follow_up_time ? ` at ${item.follow_up_time.slice(0, 5)}` : ''}
                              </p>
                              {item.assignee_name && (
                                <p className="text-xs text-slate-500">{item.assignee_name}</p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-slate-500 italic">{item.notes}</p>
                              )}
                              <div className="pt-1">
                                {item.status === 'completed' ? (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Completed</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pending</span>
                                )}
                              </div>
                            </div>
                          )}

                          {item._kind === 'audit' && item.action === 'status_change' && (
                            <div className="pl-9">
                              <p className="text-sm text-slate-600">
                                Status changed to{' '}
                                <span className="font-medium text-slate-800">
                                  {OPP_STATUSES.find(s => s.value === item.diff?.to)?.label ?? String(item.diff?.to ?? '')}
                                </span>
                              </p>
                            </div>
                          )}
                        </article>
                      )
                    }

                    return (
                      <div className="space-y-6">
                        {upcomingItems.length > 0 && (
                          <div>
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Upcoming</p>
                            <div className="space-y-3">{upcomingItems.map(renderItem)}</div>
                          </div>
                        )}
                        {monthGroups.map(({ month, items }) => (
                          <div key={month}>
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{month}</p>
                            <div className="space-y-3">{items.map(renderItem)}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">

              {/* Next Follow-up card */}
              {(() => {
                const nextFu = timeline
                  .filter(item => item._kind === 'follow_up' && !item.completed_at)
                  .sort((a, b) => (a.follow_up_date ?? '').localeCompare(b.follow_up_date ?? ''))[0] ?? null
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Bell size={14} className="text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-700">Next Follow-up</h3>
                    </div>
                    {nextFu ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Phone size={13} className="text-slate-400 shrink-0" />
                          <span className="font-medium capitalize">
                            {nextFu.type ?? 'Follow-up'} — {nextFu.follow_up_date}
                            {nextFu.follow_up_time ? ` at ${nextFu.follow_up_time.slice(0, 5)}` : ''}
                          </span>
                        </div>
                        {nextFu.assignee_name && (
                          <p className="pl-5 text-xs text-slate-500">{nextFu.assignee_name}</p>
                        )}
                        {nextFu.notes && (
                          <p className="pl-5 text-xs text-slate-500 italic">{nextFu.notes}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No follow-ups scheduled.</p>
                    )}
                  </div>
                )
              })()}

              {/* Information card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={14} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">Information</h3>
                </div>
                <dl>
                  <InfoRow label="Quote Number"       value={formatQuoteNumber(opp.opportunity_number)} />
                  <InfoRow label="Service Type"       value={SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type} />
                  <InfoRow label="Move Size"          value={opp.move_size ? (MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g,' ')) : '—'} />
                  <InfoRow label="Branch"             value="Main Office" />
                  <InfoRow label="Opportunity Type"   value={opp.service_type === 'long_distance' || opp.service_type === 'international' ? opp.service_type.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Local'} />
                  <InfoRow label="Source"             value={opp.lead_source?.name ?? '—'} />
                  <InfoRow label="Assigned To"        value={opp.agent?.full_name ?? 'Unassigned'} editable onClick={() => setShowQuickEdit(true)} />
                  <InfoRow label="Estimator"          value="Unassigned" />
                  <InfoRow label="Move Coordinator"   value="Unassigned" />
                  <InfoRow label="Lead Status"        value="—" />
                  <InfoRow
                    label="Outstanding Balance"
                    value={
                      <span className={cn('font-semibold', balanceDue > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {estimateTotal > 0 ? (balanceDue > 0 ? formatCurrency(balanceDue) : 'Paid') : '—'}
                      </span>
                    }
                  />
                </dl>
              </div>

              {/* Stops card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={14} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">Stops</h3>
                </div>
                <div className="space-y-4">
                  {/* Origin */}
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Origin Address</p>
                    {opp.origin_address_line1 ? (
                      <div className="text-sm text-slate-700">
                        <p>{opp.origin_address_line1}</p>
                        {opp.origin_address_line2 && <p>{opp.origin_address_line2}</p>}
                        <p>{[opp.origin_city, opp.origin_province, opp.origin_postal_code].filter(Boolean).join(', ')}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {opp.origin_dwelling_type && <span className="capitalize">{opp.origin_dwelling_type.replace(/_/g,' ')}</span>}
                          {(opp.origin_stairs_count ?? 0) > 0 && (
                            <span> • {opp.origin_stairs_count} flight{opp.origin_stairs_count !== 1 ? 's' : ''} of stairs</span>
                          )}
                          {opp.origin_has_elevator && <span> • Elevator</span>}
                        </p>
                      </div>
                    ) : <p className="text-sm text-slate-400">Not set</p>}
                  </div>
                  {/* Destination */}
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination Address</p>
                    {opp.dest_address_line1 ? (
                      <div className="text-sm text-slate-700">
                        <p>{opp.dest_address_line1}</p>
                        {opp.dest_address_line2 && <p>{opp.dest_address_line2}</p>}
                        <p>{[opp.dest_city, opp.dest_province, opp.dest_postal_code].filter(Boolean).join(', ')}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {opp.dest_dwelling_type && <span className="capitalize">{opp.dest_dwelling_type.replace(/_/g,' ')}</span>}
                          {(opp.dest_stairs_count ?? 0) > 0 && (
                            <span> • {opp.dest_stairs_count} flight{opp.dest_stairs_count !== 1 ? 's' : ''} of stairs</span>
                          )}
                          {opp.dest_has_elevator && <span> • Elevator</span>}
                        </p>
                      </div>
                    ) : <p className="text-sm text-slate-400">Not set</p>}
                  </div>
                </div>
              </div>

              {/* Opportunity Details card */}
              {(() => {
                const vol = getVolumeForMoveSize(opp.move_size)
                if (!vol) return null
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase size={14} className="text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-700">Opportunity Details</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Volume</p>
                        <p className="mt-0.5 font-semibold text-slate-900">{vol.cuft.toLocaleString()} cuft</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weight</p>
                        <p className="mt-0.5 font-semibold text-slate-900">{vol.lbs.toLocaleString()} lbs</p>
                      </div>
                    </div>
                  </div>
                )
              })()}

            </div>
          </div>
        )}

        {/* ── ESTIMATE TAB ── */}
        {tab === 'estimate' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Left: move details + addresses + notes */}
            <div className="space-y-4 lg:col-span-2">
              {/* Stat cards */}
              {(() => {
                const vol = getVolumeForMoveSize(opp.move_size)
                const laborCharge = charges.find(c => c.charge_type === 'moving_labor')
                const lc = laborCharge?.config ?? {}
                const pkgName = packageDisplayName(lc.package_name as string | null)
                const numTrucks = Number(lc.num_trucks ?? 1)
                const numCrew = Number(lc.num_crew ?? 2)
                const hourlyRate = Number(lc.hourly_rate ?? 0)
                const billableHours = Number(lc.billable_hours ?? lc.labor_hours ?? 0)
                const travelHours = Number(lc.travel_hours ?? 0)
                const loadHours = Number(lc.load_hours ?? 0)
                const unloadHours = Number(lc.unload_hours ?? 0)
                const bufferHours = Number(lc.handling_buffer_hours ?? 0)
                const hasLaborCharge = Boolean(laborCharge)

                return (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Move Size</p>
                        <select
                          value={opp.move_size ?? ''}
                          onChange={event => saveMoveSize(event.target.value)}
                          disabled={savingMoveSize}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20 disabled:opacity-60"
                        >
                          <option value="">—</option>
                          {Object.entries(MOVE_SIZE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        {vol && <p className="mt-0.5 text-[10px] text-slate-400">{vol.cuft.toLocaleString()} cu ft · {vol.lbs.toLocaleString()} lbs</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Move Date</p>
                          <button
                            type="button"
                            onClick={openDateEdit}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit move date"
                          >
                            <Calendar size={13} />
                          </button>
                        </div>
                        <p className="mt-1 text-base font-bold text-slate-900 leading-tight">
                          {opp.service_date ? formatDateShort(opp.service_date) : 'TBD'}
                        </p>
                        {daysUntilMove && <p className="mt-0.5 text-[10px] text-slate-400">{daysUntilMove}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Est. Total</p>
                        <p className="mt-1 text-base font-bold text-slate-900">
                          {estimateTotal > 0 ? formatCurrency(estimateTotal) : '—'}
                        </p>
                        {balanceDue > 0 && <p className="mt-0.5 text-[10px] text-slate-400">Balance: {formatCurrency(balanceDue)}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Package</p>
                        <p className="mt-1 text-base font-bold text-slate-900">{pkgName ?? '—'}</p>
                        {hourlyRate > 0 && <p className="mt-0.5 text-[10px] text-slate-400">{formatCurrency(hourlyRate)}/hr</p>}
                      </div>
                    </div>

                    {/* Job Summary — only shown when a Moving Labor charge exists */}
                    {hasLaborCharge && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Job Summary</h2>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 text-sm">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Crew</p>
                            <p className="mt-0.5 font-semibold text-slate-900">{numTrucks} truck · {numCrew} movers</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hourly rate</p>
                            <p className="mt-0.5 font-semibold text-slate-900">{formatCurrency(hourlyRate)}/hr</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Labour time</p>
                            <p className="mt-0.5 font-semibold text-slate-900">{billableHours}h billable</p>
                            {(loadHours > 0 || unloadHours > 0 || bufferHours > 0) && (
                              <p className="text-[10px] text-slate-400">
                                {loadHours}h load · {unloadHours}h unload · {bufferHours}h buffer
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Travel time</p>
                            <p className="mt-0.5 font-semibold text-slate-900">{travelHours}h</p>
                            {lc.distance_km != null && (
                              <p className="text-[10px] text-slate-400">{String(lc.distance_km)} km · {String(lc.drive_time_minutes ?? '?')} min drive</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}

              {/* Trip Info — SmartMoving-style with dispatch, legs, map */}
              {(() => {
                const mapsUrl = buildMapsUrl(opp)
                return (
                  <div className="rounded-xl border border-slate-200 bg-white">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
                      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Stops</h2>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toast.info('Multi-stop support coming soon.')}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          + Add Stop
                        </button>
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <MapIcon size={12} /> Map
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const origin = [opp.origin_address_line1, opp.origin_city, opp.origin_province].filter(Boolean).join(', ')
                            const dest = [opp.dest_address_line1, opp.dest_city, opp.dest_province].filter(Boolean).join(', ')
                            const text = [
                              `DISPATCH: ${DISPATCH_ADDRESS}`,
                              origin ? `ORIGIN: ${origin}` : 'ORIGIN: Not set',
                              dest ? `DESTINATION: ${dest}` : 'DESTINATION: Not set',
                              `RETURN: ${DISPATCH_ADDRESS}`,
                            ].join('\n')
                            navigator.clipboard.writeText(text).then(
                              () => toast.success('Stops copied to clipboard.'),
                              () => toast.error('Could not copy — check browser permissions.'),
                            )
                          }}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Copy Stops
                        </button>
                        <button
                          type="button"
                          onClick={() => toast.info('Clear Stops removes any extra intermediate stops.')}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Leg badge strip */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-5 py-2.5 min-h-[38px]">
                      {tripDataLoading ? (
                        <>
                          <div className="h-5 w-32 animate-pulse rounded-full bg-slate-100" />
                          <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
                          <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
                          <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
                        </>
                      ) : tripData?.ok && tripData.legs?.length ? (
                        <>
                          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-white">
                            RT {formatMinutes(tripData.totalDriveTimeMinutes ?? 0)} / {tripData.totalDistanceKm ?? 0} km
                          </span>
                          {tripData.legs.map(leg => (
                            <span key={leg.label} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              {leg.label}&nbsp;&nbsp;{formatMinutes(leg.driveTimeMinutes)} / {leg.distanceKm} km
                            </span>
                          ))}
                        </>
                      ) : tripData?.ok === false && tripData.reason !== 'missing_addresses' ? (
                        <span className="text-[10px] text-amber-600">{tripData.message}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          {(!opp.origin_address_line1 || !opp.dest_address_line1)
                            ? 'Add addresses to see trip distances'
                            : 'Calculating distances…'}
                        </span>
                      )}
                    </div>

                    {/* Stop list */}
                    <div className="p-5">
                      {/* DISPATCH */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white">
                            <div className="h-2 w-2 rounded-full bg-slate-400" />
                          </div>
                          <div className="mt-1 w-px flex-1 bg-slate-200" style={{ minHeight: 20 }} />
                        </div>
                        <div className="pb-4 min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Dispatch</p>
                          <p className="text-sm text-slate-600">{DISPATCH_ADDRESS}</p>
                        </div>
                      </div>

                      {/* ORIGIN */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                            1
                          </div>
                          <div className="mt-1 w-px flex-1 bg-slate-200" style={{ minHeight: 20 }} />
                        </div>
                        <div className="pb-4 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                              <MapPin size={10} /> Pick-up / Origin
                            </p>
                            <button
                              type="button"
                              onClick={() => openAddressEdit('origin')}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Edit origin"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                          <AddressBlock prefix="origin" data={opp} />
                        </div>
                      </div>

                      {/* DESTINATION */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-kratos text-[11px] font-bold text-slate-950">
                            2
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                              <MapPin size={10} /> Drop-off / Destination
                            </p>
                            <button
                              type="button"
                              onClick={() => openAddressEdit('dest')}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Edit destination"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                          <AddressBlock prefix="dest" data={opp} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Package recommendation — 4 tiers */}
              <PackageTierCards
                opportunityId={id}
                moveSize={opp.move_size}
                moveDate={opp.service_date}
                appliedChargeConfig={
                  (charges.find(c => c.charge_type === 'moving_labor')?.config ?? null) as Record<string, unknown> | null
                }
                onApplied={() => fetchCharges()}
              />

              {/* Charges */}
              <ChargesSection
                charges={charges}
                onAddCharge={() => { setTariffPreFill(null); setEditingCharge(null); setChargePanelOpen(true) }}
                onEditCharge={c => { setTariffPreFill(null); setEditingCharge(c); setChargePanelOpen(true) }}
                onDuplicateCharge={duplicateCharge}
                onDeleteCharge={deleteCharge}
                deleting={deletingChargeId}
              />

              {/* Notes — tabbed */}
              <div className="rounded-xl border border-slate-200 bg-white">
                {/* Tab bar */}
                <div className="flex items-center gap-0 border-b border-slate-200 px-4 pt-3">
                  {([
                    { key: 'internal',   label: 'Internal Notes' },
                    { key: 'customer',   label: 'Customer Notes' },
                    { key: 'crew',       label: 'Crew Notes' },
                    { key: 'dispatcher', label: 'Dispatcher Notes' },
                  ] as const).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setNotesTab(t.key)}
                      className={cn(
                        'mr-1 rounded-t px-3 py-2 text-xs font-semibold transition-colors',
                        notesTab === t.key
                          ? 'border-b-2 border-kratos text-slate-900'
                          : 'text-slate-400 hover:text-slate-700',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  {notesTab === 'internal' && (
                    <NoteEditor
                      value={notes}
                      onChange={setNotes}
                      onBlur={saveNotes}
                      placeholder="Add internal notes visible only to agents..."
                      saving={savingNoteField === 'notes'}
                    />
                  )}
                  {notesTab === 'customer' && (
                    <NoteEditor
                      value={customerNotes}
                      onChange={setCustomerNotes}
                      onBlur={() => saveNoteField('customer_notes', customerNotes)}
                      placeholder="Add customer-facing quote notes..."
                      saving={savingNoteField === 'customer_notes'}
                    />
                  )}
                  {notesTab === 'crew' && (
                    <NoteEditor
                      value={crewNotes}
                      onChange={setCrewNotes}
                      onBlur={() => saveNoteField('crew_notes', crewNotes)}
                      placeholder="Add crew notes for move day..."
                      saving={savingNoteField === 'crew_notes'}
                    />
                  )}
                  {notesTab === 'dispatcher' && (
                    <NoteEditor
                      value={dispatcherNotes}
                      onChange={setDispatcherNotes}
                      onBlur={() => saveNoteField('dispatcher_notes', dispatcherNotes)}
                      placeholder="Add dispatcher notes..."
                      saving={savingNoteField === 'dispatcher_notes'}
                    />
                  )}
                  {notesSaving && !savingNoteField && <p className="mt-1 text-xs text-slate-400">Saving...</p>}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-3">
              {/* Information card */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <ClipboardCheck size={14} />
                  </span>
                  <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Information</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <InfoRow label="Quote #" value={formatQuoteNumber(opp.opportunity_number)} />
                  <InfoRow label="Status" value={OPP_STATUSES.find(s => s.value === opp.status)?.label ?? opp.status} />
                  <InfoRow label="Agent" value={opp.agent?.full_name ?? '—'} />
                  <InfoRow label="Source" value={opp.lead_source?.name ?? '—'} />
                  <InfoRow label="Service" value={SERVICE_TYPE_LABELS[opp.service_type] ?? opp.service_type} />
                  <InfoRow label="Move date" value={opp.service_date ? formatDateShort(opp.service_date) : 'TBD'} />
                  <InfoRow label="Move size" value={opp.move_size ? (MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g,' ')) : '—'} />
                </div>
              </section>

              <PanelSection title="Quote Total" icon={ShieldCheck}>
                <MoneyRow label="Subtotal" value={subtotal > 0 ? formatCurrency(subtotal) : '—'} />
                <MoneyRow label="Discounts" value={discounts > 0 ? `-${formatCurrency(discounts)}` : '—'} />
                <MoneyRow label="HST" value={salesTax > 0 ? formatCurrency(salesTax) : '—'} />
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <MoneyRow label="Estimate Total" value={estimateTotal > 0 ? formatCurrency(estimateTotal) : '—'} strong />
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <MoneyRow label="Deposit Required" value={formatCurrency(Number(opp.deposit_amount ?? 150) || 150)} />
                  <MoneyRow label="Total Paid" value={formatCurrency(totalPaid)} />
                  <MoneyRow label="Balance Due" value={balanceDue > 0 ? formatCurrency(balanceDue) : '—'} strong />
                </div>
                <button
                  onClick={() => setPaymentDrawerOpen(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-kratos px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                >
                  <CreditCard size={16} /> Add Payment
                </button>
              </PanelSection>

              <PanelActionSection
                title="Inventory"
                icon={Boxes}
                body={opp.move_size ? (MOVE_SIZE_LABELS[opp.move_size] ?? opp.move_size.replace(/_/g, ' ')) : 'No inventory yet'}
                detail={(() => {
                  const v = getVolumeForMoveSize(opp.move_size)
                  return v ? `~${v.cuft.toLocaleString()} cu ft · ~${v.lbs.toLocaleString()} lbs estimated` : '—'
                })()}
              />
            </div>
          </div>
        )}

        {tab === 'storage' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-950">Storage</h2>
            <p className="mt-2 text-sm text-slate-500">Storage module coming soon. Future work will cover storage accounts, SIT, pickup/delivery scheduling, monthly billing, and storage balances for this quote.</p>
          </div>
        )}

        {tab === 'files' && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <FileText className="mx-auto text-slate-300" size={28} />
            <h2 className="mt-3 text-lg font-semibold text-slate-950">Files & Photos</h2>
            <p className="mt-2 text-sm text-slate-500">Upload area coming soon for quote documents, photos, signed paperwork, and customer attachments.</p>
          </div>
        )}

        {tab === 'accounting' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <PanelSection title="Payments" icon={CreditCard}>
              <MoneyRow label="Deposit" value={formatCurrency(Number(opp.deposit_amount ?? 150) || 150)} />
              <MoneyRow label="Total Paid" value={formatCurrency(totalPaid)} />
              <MoneyRow label="Balance Due" value={balanceDue > 0 ? formatCurrency(balanceDue) : '—'} strong />
              <button
                onClick={() => setPaymentDrawerOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-kratos px-4 py-2.5 text-sm font-semibold text-slate-950"
              >
                <CreditCard size={16} /> Add Payment
              </button>
            </PanelSection>
            <PanelActionSection title="Invoices" icon={ReceiptText} body="Invoice workflow coming soon" detail="Invoices will connect to quote totals, deposits, and payment status." />
            <PanelActionSection title="Stripe / Manual Status" icon={WalletCards} body="No connected payment summary yet" detail="Recorded payments and Stripe webhook status will appear here." />
          </div>
        )}

        {tab === 'profitability' && opp.can_view_profitability && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Estimated Revenue</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{opp.total_amount > 0 ? formatCurrency(opp.total_amount) : '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Estimated Cost</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{opp.estimated_cost > 0 ? formatCurrency(opp.estimated_cost) : '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Estimated Profit</p>
              <p className={`mt-2 text-2xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{opp.total_amount > 0 ? formatCurrency(profit) : '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Margin</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{opp.total_amount > 0 ? `${Math.round((profit / opp.total_amount) * 100)}%` : '—'}</p>
            </div>
          </div>
        )}
      </div>

      {paymentDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" onClick={() => setPaymentDrawerOpen(false)} />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl shadow-slate-950/20">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Payments</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Add Payment</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Quote {formatQuoteNumber(opp.opportunity_number)} · {balanceDue > 0 ? formatCurrency(balanceDue) : 'No balance'} due
                  </p>
                </div>
                <button
                  onClick={() => setPaymentDrawerOpen(false)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close payment drawer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Payment method</p>
              <div className="space-y-2">
                {PAYMENT_METHODS.map(({ label, value, icon: Icon, note }) => (
                  <button
                    key={value}
                    onClick={() => selectPaymentMethod(value)}
                    disabled={paymentLoading}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                      selectedPaymentMethod === value
                        ? 'border-kratos bg-kratos/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-950">{label}</span>
                      <span className="block text-xs text-slate-500">{note}</span>
                    </span>
                    {paymentLoading && selectedPaymentMethod === value ? (
                      <Loader2 size={16} className="animate-spin text-slate-400" />
                    ) : (
                      <ArrowRight size={16} className="text-slate-300" />
                    )}
                  </button>
                ))}
              </div>

              {selectedPaymentConfig && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Selected</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selectedPaymentConfig.label}</p>
                    </div>
                    <button
                      onClick={() => setSelectedPaymentMethod(null)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white"
                    >
                      Change
                    </button>
                  </div>

                  <div className="grid gap-3">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Amount
                      <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 focus-within:border-kratos focus-within:ring-2 focus-within:ring-kratos/20">
                        <span className="mr-2 text-sm font-semibold text-slate-500">$</span>
                        <input
                          value={paymentAmount}
                          onChange={e => setPaymentAmount(e.target.value)}
                          inputMode="decimal"
                          placeholder="0.00"
                          className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none"
                        />
                      </div>
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Payment date
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                      />
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Payment status
                      <select
                        value={paymentStatus}
                        onChange={e => setPaymentStatus(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                      >
                        <option value="received">Received</option>
                        <option value="recorded">Recorded</option>
                        <option value="pending">Pending</option>
                      </select>
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Reference / confirmation number
                      <input
                        value={paymentReference}
                        onChange={e => setPaymentReference(e.target.value)}
                        placeholder="Optional"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                      />
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Notes
                      <textarea
                        value={paymentNotes}
                        onChange={e => setPaymentNotes(e.target.value)}
                        rows={3}
                        placeholder="Optional"
                        className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none focus:border-kratos focus:ring-2 focus:ring-kratos/20"
                      />
                    </label>
                  </div>

                  {(selectedIsRecordOnly || selectedSupportsStripe) && (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      Record only. No card details are processed or stored in Kratos CRM.
                    </p>
                  )}

                  {selectedSupportsStripe ? (
                    <div className="mt-4 grid gap-2">
                      <button
                        onClick={startStripeCheckout}
                        disabled={paymentLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-kratos px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                      >
                        {paymentLoading && <Loader2 size={14} className="animate-spin" />}
                        Send Stripe Checkout
                      </button>
                      <button
                        onClick={() => recordPayment(selectedPaymentMethod === 'credit_card' ? 'credit_card_record' : 'debit_card_record')}
                        disabled={paymentLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                      >
                        {selectedPaymentMethod === 'credit_card' ? 'Record manual card payment' : 'Record manual debit/card payment'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => recordPayment()}
                      disabled={paymentLoading}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-kratos px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                      {paymentLoading && <Loader2 size={14} className="animate-spin" />}
                      Record Payment
                    </button>
                  )}
                </div>
              )}

              {paymentMessage && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {paymentMessage}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <p className="text-xs leading-5 text-slate-500">
                Stripe Checkout is hosted by Stripe. Kratos CRM never stores card numbers, CVV, or full expiry.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Modals */}
      {showStatusModal && (
        <ChangeStatusModal
          opportunityId={opp.id}
          currentStatus={opp.status}
          onClose={() => setShowStatusModal(false)}
          onSuccess={newStatus => {
            setOpp(p => p ? { ...p, status: newStatus } : p)
            load()
            loadTimeline()
          }}
        />
      )}

      {showQuickEdit && (
        <QuickEditModal
          data={{
            oppId:             opp.id,
            customerId:        opp.customer?.id ?? '',
            customerName:      opp.customer?.full_name ?? '',
            customerPhone:     opp.customer?.phone ?? '',
            customerPhoneType: opp.customer?.phone_type ?? 'mobile',
            customerEmail:     opp.customer?.email ?? '',
          }}
          onClose={() => setShowQuickEdit(false)}
          onSaved={load}
          onOpenFullEdit={() => { setShowQuickEdit(false); setShowEditModal(true) }}
        />
      )}

      {showEditModal && (
        <CreateOpportunityModal
          onClose={() => { setShowEditModal(false); load() }}
          editId={opp.id}
        />
      )}

      {addressEditData && (
        <EditAddressModal
          data={addressEditData}
          onClose={() => setAddressEditData(null)}
          onSaved={load}
        />
      )}

      <ChargeSidePanel
        open={chargePanelOpen}
        oppId={opp.id}
        editingCharge={editingCharge}
        charges={charges}
        defaultLaborConfig={tariffPreFill}
        onClose={() => { setChargePanelOpen(false); setEditingCharge(null); setTariffPreFill(null) }}
        onSaved={() => { fetchCharges(); setTariffPreFill(null) }}
      />

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="font-semibold text-slate-900">Delete Quote?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete <span className="font-mono font-medium">{opp.opportunity_number}</span>? This can be recovered by an admin.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InfoRow({
  label,
  value,
  editable,
  onClick,
}: {
  label: string
  value: ReactNode
  editable?: boolean
  onClick?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd
        className={cn(
          'text-right text-sm font-medium text-slate-900',
          editable && 'flex cursor-pointer items-center gap-0.5 hover:text-kratos',
        )}
        onClick={editable ? onClick : undefined}
      >
        {value}
        {editable && <ChevronDown size={11} className="text-slate-400 shrink-0" />}
      </dd>
    </div>
  )
}

function PanelSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: ElementType
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon size={14} />
        </span>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function PanelActionSection({
  title,
  icon,
  body,
  detail,
}: {
  title: string
  icon: ElementType
  body: string
  detail: string
}) {
  return (
    <PanelSection title={title} icon={icon}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{body}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <button className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
          View
        </button>
      </div>
    </PanelSection>
  )
}

function MoneyRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className={strong ? 'font-semibold text-slate-700' : 'text-slate-500'}>{label}</span>
      <span className={strong ? 'font-bold text-slate-950' : 'font-semibold text-slate-800'}>{value}</span>
    </div>
  )
}

function NoteEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  saving,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  placeholder: string
  saving: boolean
}) {
  return (
    <>
      <textarea
        rows={5}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
      />
      {saving && <p className="mt-1 text-xs text-slate-400">Saving...</p>}
    </>
  )
}
