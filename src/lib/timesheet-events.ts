// Audit log for timesheet state changes. Deliberately NOT a 'use server' file — every export from one of
// those becomes a directly callable server action, and this writes on behalf of an already-authorized action.

import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TimesheetEventAction } from '@/types'

/**
 * Appends a row to timesheet_events. Best-effort: the state change it describes has already happened, so a
 * logging failure is reported to the server log rather than thrown (which would make a successful action look failed).
 */
export async function logTimesheetEvent(
  admin: SupabaseClient,
  e: { timesheetId: string; actorId: string | null; action: TimesheetEventAction; reasonCode?: string | null; note?: string | null; signature?: { name: string; employeeNumber?: number; attestation: string } },
) {
  // A signature carries where it came from. Best-effort: outside a request there are no headers.
  let ip: string | null = null
  if (e.signature) {
    try { ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || null } catch { /* no request context */ }
  }
  const { error } = await admin.from('timesheet_events').insert({
    timesheet_id: e.timesheetId,
    actor_id: e.actorId,
    action: e.action,
    reason_code: e.reasonCode ?? null,
    note: e.note ?? null,
    ...(e.signature ? { signature_name: e.signature.name, signer_employee_number: e.signature.employeeNumber ?? null, attestation: e.signature.attestation, signed_ip: ip } : {}),
  })
  if (error) console.error('logTimesheetEvent failed', e.action, error.message)
}
