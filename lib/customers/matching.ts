import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhoneToE164 } from '@/lib/phone/normalizePhone'

type CustomerCandidate = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
}

export type CustomerIdentityInput = {
  customer_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_phone_type?: string | null
  customer_secondary_phone?: string | null
  customer_secondary_phone_type?: string | null
  customer_email?: string | null
}

export function normalizeEmail(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
}

export function normalizePhone(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = normalizePhoneToE164(value).normalized
  return normalized.trim() || null
}

function phoneMatchKey(value: string | null | undefined) {
  if (!value) return null
  const normalized = normalizePhone(value)
  if (!normalized) return null
  const digits = normalized.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits || normalized.toLowerCase()
}

function sameExactName(a: string | null | undefined, b: string | null | undefined) {
  return Boolean(a?.trim() && b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase())
}

function sameEmail(a: string | null | undefined, b: string | null | undefined) {
  return Boolean(normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b))
}

function canAttachToIdentityMatch(customer: CustomerCandidate, input: {
  fullName: string
  normalizedEmail: string | null
}) {
  if (sameExactName(customer.full_name, input.fullName)) return true
  if (input.normalizedEmail && sameEmail(customer.email, input.normalizedEmail)) return true
  return false
}

export async function findOrCreateCustomer(
  supabase: SupabaseClient,
  input: CustomerIdentityInput,
) {
  if (input.customer_id) {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('id', input.customer_id)
      .neq('is_deleted', true)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Customer record not found')
    return input.customer_id
  }

  const fullName = input.customer_name?.trim()
  if (!fullName) throw new Error('Customer name is required')

  const normalizedPhone = normalizePhone(input.customer_phone)
  const normalizedSecondaryPhone = normalizePhone(input.customer_secondary_phone)
  const normalizedEmail = normalizeEmail(input.customer_email)
  const primaryPhoneKey = phoneMatchKey(normalizedPhone)
  const secondaryPhoneKey = phoneMatchKey(normalizedSecondaryPhone)

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, created_at')
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(5000)

  if (error) throw error

  const candidates = (customers ?? []) as CustomerCandidate[]
  const phoneMatch = candidates.find(customer => {
    const key = phoneMatchKey(customer.phone)
    return Boolean(
      key &&
      (key === primaryPhoneKey || key === secondaryPhoneKey) &&
      canAttachToIdentityMatch(customer, { fullName, normalizedEmail }),
    )
  })
  if (phoneMatch) return phoneMatch.id

  if (normalizedEmail) {
    const emailMatch = candidates.find(customer =>
      customer.email?.trim().toLowerCase() === normalizedEmail &&
      (sameExactName(customer.full_name, fullName) || phoneMatchKey(customer.phone) === primaryPhoneKey),
    )
    if (emailMatch) return emailMatch.id
  }

  if (!normalizedPhone && !normalizedEmail) {
    const nameMatch = candidates.find(customer => sameExactName(customer.full_name, fullName))
    if (nameMatch) return nameMatch.id
  }

  const { data: customer, error: createError } = await supabase
    .from('customers')
    .insert({
      full_name: fullName,
      phone: normalizedPhone,
      phone_type: input.customer_phone_type || null,
      secondary_phone: normalizedSecondaryPhone,
      secondary_phone_type: input.customer_secondary_phone_type || null,
      email: normalizedEmail,
    })
    .select('id')
    .single()

  if (createError) throw createError
  return customer.id as string
}
