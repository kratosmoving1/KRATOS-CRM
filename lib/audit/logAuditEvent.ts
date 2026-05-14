import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

type AuditEvent = {
  actorUserId: string | null
  action: string
  entityType: string
  entityId?: string | null
  oldData?: Json | null
  newData?: Json | null
  ipAddress?: string | null
  userAgent?: string | null
}

// Server-side only. Non-blocking by design: audit failure should not roll back
// the primary user operation, but it must be visible in server logs.
export async function logAuditEvent({
  actorUserId,
  action,
  entityType,
  entityId = null,
  oldData = null,
  newData = null,
  ipAddress = null,
  userAgent = null,
}: AuditEvent) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('audit_logs').insert({
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_data: oldData,
      new_data: newData,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    if (error) console.error('Audit log insert failed:', error)
  } catch (err) {
    console.error('Audit logging unavailable:', err)
  }
}
