import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [commsResult, auditResult, followUpsResult] = await Promise.all([
    supabase
      .from('communications')
      .select('id, type, direction, subject, body, call_outcome, call_duration_seconds, created_at, created_by, profiles!created_by(full_name)')
      .eq('opportunity_id', params.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('audit_log')
      .select('id, action, diff, created_at, profiles!user_id(full_name)')
      .eq('entity_type', 'opportunity')
      .eq('entity_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('follow_ups')
      .select('id, type, notes, follow_up_date, follow_up_time, status, completed_at, created_at, assignee:profiles!assigned_to_id(full_name), creator:profiles!created_by_id(full_name)')
      .eq('opportunity_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  type ProfilesField = { full_name: string }[] | { full_name: string } | null | undefined

  function actorName(profiles: ProfilesField): string | null {
    if (!profiles) return null
    if (Array.isArray(profiles)) return profiles[0]?.full_name ?? null
    return profiles.full_name ?? null
  }

  const comms = (commsResult.data ?? []).map(c => {
    const { profiles, ...rest } = c as typeof c & { profiles?: ProfilesField }
    return { ...rest, _kind: 'communication' as const, actor: actorName(profiles) }
  })

  const audits = (auditResult.data ?? []).map(a => {
    const { profiles, ...rest } = a as typeof a & { profiles?: ProfilesField }
    return { ...rest, _kind: 'audit' as const, actor: actorName(profiles) }
  })

  const followUps = (followUpsResult.data ?? []).map(f => {
    const { assignee, creator, ...rest } = f as typeof f & { assignee?: ProfilesField; creator?: ProfilesField }
    return {
      ...rest,
      _kind: 'follow_up' as const,
      actor: actorName(creator),
      assignee_name: actorName(assignee),
    }
  })

  const timeline = [...comms, ...audits, ...followUps].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return NextResponse.json(timeline)
}
