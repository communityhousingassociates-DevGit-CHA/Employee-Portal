// Audit log for leave requests. Deliberately NOT a 'use server' file — every export from one of those becomes a
// directly callable server action, and this writes on behalf of an already-authorized action.

import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeaveEvent, LeaveEventAction } from '@/types'

/**
 * Appends a row to leave_request_events, snapshotting the actor's name and role. Best-effort: the state change it
 * describes has already happened, so a logging failure is reported to the server log rather than thrown (which would
 * make a successful approval look failed).
 */
export async function logLeaveEvent(
  admin: SupabaseClient,
  e: { requestId: string; action: LeaveEventAction; actor: { id: string; name: string; role: string; employee_number?: number } | null; note?: string | null; attestation?: string },
) {
  // A signature carries where it came from. Best-effort: outside a request (cron/scripts) there are no headers.
  let ip: string | null = null
  if (e.attestation) {
    try { ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || null } catch { /* no request context */ }
  }
  const { error } = await admin.from('leave_request_events').insert({
    request_id: e.requestId,
    action: e.action,
    actor_id: e.actor?.id ?? null,
    actor_name: e.actor?.name ?? 'System (balance covered the request)',
    actor_role: e.actor?.role ?? null,
    note: e.note ?? null,
    ...(e.attestation && e.actor ? { signature_name: e.actor.name, signer_employee_number: e.actor.employee_number ?? null, attestation: e.attestation, signed_ip: ip } : {}),
  })
  if (error) console.error('logLeaveEvent failed', e.action, error.message)
}

/** Event history for a set of requests, oldest first, keyed by request id. */
export async function loadLeaveEvents(admin: SupabaseClient, requestIds: string[]): Promise<Map<string, LeaveEvent[]>> {
  const out = new Map<string, LeaveEvent[]>()
  if (requestIds.length === 0) return out
  const { data, error } = await admin
    .from('leave_request_events')
    .select('id, request_id, action, actor_id, actor_name, actor_role, note, backfilled, created_at, signature_name, signer_employee_number, attestation')
    .in('request_id', requestIds)
    .order('created_at')
  if (error) throw new Error(error.message)
  for (const ev of data ?? []) {
    const list = out.get(ev.request_id) ?? []
    list.push(ev as LeaveEvent)
    out.set(ev.request_id, list)
  }
  return out
}
