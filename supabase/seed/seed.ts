/**
 * Kratos CRM — Seed Script
 * Run with: npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── helpers ───────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1))
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
function subDays(date: Date, days: number): Date {
  return addDays(date, -days)
}
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
}
function randomDateInRange(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// ─── data ──────────────────────────────────────────────────
const LEAD_SOURCES = [
  { name: 'LSA',          category: 'paid' as const },
  { name: 'Google Ads',   category: 'paid' as const },
  { name: 'Facebook Ads', category: 'paid' as const },
  { name: 'Your Website', category: 'organic' as const },
  { name: 'Past Client',  category: 'repeat' as const },
  { name: 'Referral',     category: 'referral' as const },
  { name: 'Yelp',         category: 'paid' as const },
  { name: 'Unknown',      category: 'other' as const },
]

const AGENTS = [
  { email: 'alex@kratosmoving.ca',   full_name: 'Alex S.',   role: 'senior_sales' as const },
  { email: 'maria@kratosmoving.ca',  full_name: 'Maria R.',  role: 'senior_sales' as const },
  { email: 'daniel@kratosmoving.ca', full_name: 'Daniel K.', role: 'junior_sales' as const },
  { email: 'priya@kratosmoving.ca',  full_name: 'Priya N.',  role: 'junior_sales' as const },
  { email: 'jordan@kratosmoving.ca', full_name: 'Jordan T.', role: 'junior_sales' as const },
]

const AGENT_PASSWORD = 'KratosTest!2026'

const FIRST_NAMES = [
  'Liam','Noah','Oliver','Elijah','William','James','Benjamin','Lucas',
  'Emma','Olivia','Ava','Sophia','Isabella','Charlotte','Amelia','Mia',
  'Mohammed','Aiden','Ethan','Harper','Evelyn','Abigail','Emily','Elizabeth',
  'Sofia','Ella','Madison','Scarlett','Victoria','Aria','Grace','Chloe',
  'Camila','Penelope','Riley','Layla','Lillian','Nora','Zoey','Mila',
]
const LAST_NAMES = [
  'Smith','Johnson','Brown','Taylor','Anderson','Thomas','Jackson','White',
  'Harris','Martin','Thompson','Garcia','Martinez','Robinson','Clark','Rodriguez',
  'Lewis','Lee','Walker','Hall','Allen','Young','Hernandez','King','Wright',
  'Lopez','Hill','Scott','Green','Adams','Baker','Gonzalez','Nelson','Carter',
  'Mitchell','Perez','Roberts','Turner','Phillips','Campbell',
]
const CITIES = [
  'Toronto, ON','Mississauga, ON','Brampton, ON','Vaughan, ON','Richmond Hill, ON',
  'Markham, ON','Oakville, ON','Burlington, ON','Hamilton, ON','North York, ON',
  'Scarborough, ON','Etobicoke, ON','Ajax, ON','Pickering, ON','Whitby, ON',
]

function randomPhone(): string {
  const area = randInt(200, 999)
  const mid  = randInt(200, 999)
  const last = randInt(1000, 9999)
  return `+1${area}${mid}${last}`
}

// Monthly revenue targets (trailing 12 months from May 2026)
// Index 0 = May 2025 (12 months ago), index 11 = May 2026 (current month)
const MONTHLY_TARGETS = [
  55000,  // May 2025
  75000,  // Jun 2025
  220000, // Jul 2025 (peak)
  185000, // Aug 2025
  160000, // Sep 2025
  120000, // Oct 2025
  80000,  // Nov 2025
  45000,  // Dec 2025
  38000,  // Jan 2026
  52000,  // Feb 2026
  90000,  // Mar 2026
  110000, // Apr 2026
  // May 2026 will be current month — less since month isn't done
]

// ─── main ──────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting Kratos CRM seed...')

  // 1. Lead sources
  console.log('  → Upserting lead sources...')
  const { data: leadSourceRows, error: lsErr } = await supabase
    .from('lead_sources')
    .upsert(LEAD_SOURCES, { onConflict: 'name' })
    .select()
  if (lsErr) { console.error('Lead sources error:', lsErr); process.exit(1) }
  const leadSources = leadSourceRows!

  // 2. Sales agents
  console.log('  → Creating sales agent auth users...')
  const agentProfileIds: Record<string, string> = {}

  for (const agent of AGENTS) {
    // Try to create auth user
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: agent.email,
      password: AGENT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: agent.full_name },
    })

    let userId: string

    if (createErr) {
      if (createErr.message.includes('already been registered') || createErr.message.includes('already exists')) {
        // User exists — find them
        const { data: list } = await supabase.auth.admin.listUsers()
        const existing = list?.users.find(u => u.email === agent.email)
        if (!existing) {
          console.error(`Could not find existing user ${agent.email}`)
          process.exit(1)
        }
        userId = existing.id
        console.log(`    ↳ ${agent.email} already exists, reusing`)
      } else {
        console.error(`Error creating ${agent.email}:`, createErr)
        process.exit(1)
      }
    } else {
      userId = created.user!.id
      console.log(`    ↳ Created ${agent.email}`)
    }

    // Upsert profile with correct role
    await supabase.from('profiles').upsert({
      id: userId,
      email: agent.email,
      full_name: agent.full_name,
      role: agent.role,
      is_active: true,
    }, { onConflict: 'id' })

    agentProfileIds[agent.email] = userId
  }

  const agentIds = Object.values(agentProfileIds)
  const alexId   = agentProfileIds['alex@kratosmoving.ca']

  // 3. Customers
  console.log('  → Upserting customers...')
  const customerRows = Array.from({ length: 80 }, (_, i) => ({
    full_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    email: `customer${i + 1}@example.com`,
    phone: randomPhone(),
    is_deleted: false,
  }))

  // Delete existing seed customers to stay idempotent
  await supabase.from('customers').delete().like('email', 'customer%@example.com')
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .insert(customerRows)
    .select()
  if (custErr) { console.error('Customers error:', custErr); process.exit(1) }

  // 4. Opportunities
  console.log('  → Generating ~250 opportunities...')

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Clear existing seeded opportunities
  await supabase.from('opportunities')
    .delete()
    .like('opportunity_number', 'KM-20%')

  const opps: Record<string, unknown>[] = []
  let oppNum = 1

  // Helper: weighted random amount
  function randomAmount(): number {
    // Cluster around $1,000–$2,000 with long tail to $8,500
    const r = Math.random()
    if (r < 0.45) return Math.round(rand(800, 1500) / 50) * 50
    if (r < 0.75) return Math.round(rand(1500, 2500) / 50) * 50
    if (r < 0.90) return Math.round(rand(2500, 4500) / 50) * 50
    return Math.round(rand(4500, 8500) / 100) * 100
  }

  function makeOpp(
    monthIndex: number, // 0 = 12 months ago, 11 = last month, 12 = current month
    status: string,
    opts: { agentId?: string | null; today?: boolean } = {},
  ): Record<string, unknown> {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (12 - monthIndex), 1)
    const monthEnd  = endOfMonth(monthDate)
    const created   = randomDateInRange(monthDate, monthEnd < today ? monthEnd : today)

    const amount    = randomAmount()
    const cost      = Math.round(amount * rand(0.55, 0.70) / 50) * 50
    const num       = `KM-2026-${String(oppNum++).padStart(5, '0')}`
    const customer  = pick(customers!)
    const source    = pick(leadSources)

    // agent assignment: Alex gets ~35% to be top performer
    let agentId: string | null = opts.agentId !== undefined ? opts.agentId : null
    if (agentId === undefined || agentId === null) {
      const r = Math.random()
      if (r < 0.08)       agentId = null           // unassigned
      else if (r < 0.43)  agentId = alexId          // Alex ~35%
      else                agentId = pick(agentIds.filter(id => id !== alexId))
    }

    const opp: Record<string, unknown> = {
      opportunity_number: num,
      customer_id:        customer.id,
      sales_agent_id:     agentId,
      lead_source_id:     source.id,
      service_type:       pick(['local','local','local','long_distance','packing','commercial']),
      status,
      total_amount:       amount,
      estimated_cost:     cost,
      pickup_city:        pick(CITIES),
      dropoff_city:       pick(CITIES),
      is_deleted:         false,
      created_at:         created.toISOString(),
    }

    // Set timestamps based on status
    if (status === 'contacted' || status === 'quote_sent' || status === 'accepted' ||
        status === 'booked' || status === 'completed' || status === 'cancelled' || status === 'lost') {
      opp.contacted_at = addDays(created, randInt(0, 1)).toISOString()
    }
    if (status === 'quote_sent' || status === 'accepted' || status === 'booked' ||
        status === 'completed' || status === 'lost') {
      opp.quote_sent_at = addDays(new Date(opp.contacted_at as string), randInt(0, 2)).toISOString()
    }
    if (status === 'accepted' || status === 'booked' || status === 'completed') {
      opp.accepted_at = addDays(new Date(opp.quote_sent_at as string), randInt(0, 3)).toISOString()
    }

    if (status === 'booked' || status === 'completed') {
      const bookedBase = opts.today
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - randInt(0, 2))
        : randomDateInRange(
            new Date(opp.accepted_at as string),
            monthEnd < today ? monthEnd : today,
          )
      opp.booked_at    = bookedBase.toISOString()
      opp.service_date = addDays(bookedBase, randInt(1, 14)).toISOString().split('T')[0]
    }

    if (status === 'completed') {
      const svcDate = new Date(opp.service_date as string)
      opp.completed_at = addDays(svcDate, randInt(0, 1)).toISOString()
    }

    if (status === 'cancelled') {
      opp.cancelled_at = addDays(created, randInt(1, 5)).toISOString()
    }
    if (status === 'lost') {
      opp.lost_at = addDays(created, randInt(2, 10)).toISOString()
    }

    return opp
  }

  // Generate historical months (indices 0-11 = May 2025 to Apr 2026)
  for (let mi = 0; mi <= 11; mi++) {
    const target = MONTHLY_TARGETS[mi] ?? 60000
    let revenue  = 0
    const monthOpps: Record<string, unknown>[] = []

    // Fill with booked/completed until we hit revenue target
    while (revenue < target) {
      const status = Math.random() < 0.6 ? 'completed' : 'booked'
      const o = makeOpp(mi, status)
      monthOpps.push(o)
      revenue += o.total_amount as number
    }

    // Add cancelled/lost (10% each of booked count)
    const bookedCount = monthOpps.length
    for (let i = 0; i < Math.round(bookedCount * 0.10); i++) {
      monthOpps.push(makeOpp(mi, 'cancelled'))
    }
    for (let i = 0; i < Math.round(bookedCount * 0.10); i++) {
      monthOpps.push(makeOpp(mi, 'lost'))
    }
    // Add quote_sent (15%)
    for (let i = 0; i < Math.round(bookedCount * 0.15); i++) {
      monthOpps.push(makeOpp(mi, 'quote_sent'))
    }

    opps.push(...monthOpps)
  }

  // Current month (index 12) — partial, fewer jobs
  // 4-5 jobs with service_date = today
  for (let i = 0; i < 5; i++) {
    const o = makeOpp(12, 'booked', { today: true })
    o.service_date = today.toISOString().split('T')[0]
    opps.push(o)
  }
  // More current-month jobs
  for (let i = 0; i < 15; i++) {
    opps.push(makeOpp(12, pick(['booked','completed'])))
  }
  // Current month other statuses
  for (let i = 0; i < 5; i++) opps.push(makeOpp(12, 'cancelled'))
  for (let i = 0; i < 5; i++) opps.push(makeOpp(12, 'lost'))

  // ~20 accepted (not booked)
  for (let i = 0; i < 20; i++) {
    opps.push(makeOpp(12, 'accepted'))
  }

  // ~21 stale opportunities — older than 7 days, non-terminal status
  const staleDate = subDays(today, 10)
  for (let i = 0; i < 21; i++) {
    const o = makeOpp(11, pick(['new_lead','contacted','quote_sent']))
    // Force created_at to > 7 days ago
    const staleCr = randomDateInRange(subDays(today, 60), staleDate)
    o.created_at = staleCr.toISOString()
    opps.push(o)
  }

  // ~15 new leads / contacted in recent weeks
  for (let i = 0; i < 8; i++) opps.push(makeOpp(12, 'new_lead', { agentId: null }))
  for (let i = 0; i < 7; i++) opps.push(makeOpp(12, 'contacted'))

  // Insert in batches of 50
  console.log(`  → Inserting ${opps.length} opportunities...`)
  for (let i = 0; i < opps.length; i += 50) {
    const batch = opps.slice(i, i + 50)
    const { error: oppErr } = await supabase.from('opportunities').insert(batch)
    if (oppErr) {
      console.error(`Opportunities batch ${i}-${i + 50} error:`, oppErr)
      process.exit(1)
    }
  }

  console.log('✅ Seed complete!')
  console.log('')
  console.log('  Agent logins (all use password: KratosTest!2026):')
  for (const a of AGENTS) {
    console.log(`    ${a.full_name} — ${a.email}`)
  }
  console.log('')
  console.log('  Create your own admin account via the Supabase dashboard → Authentication → Users → Add User')
  console.log('  Then update their profile role to "admin" in the profiles table.')
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
