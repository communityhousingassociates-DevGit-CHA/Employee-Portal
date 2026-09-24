// Audit log for timesheet state changes. Deliberately NOT a 'use server' file — every export from one of
// those becomes a directly callable server action, and this writes on behalf of an already-authorized action.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TimesheetEventAction } from '@/types'

/**
 * Appends a row to timesheet_events. Best-effort: the state change it describes has already happened, so a
 * logging failure is reported to the server log rather than thrown (which would make a successful action look failed).
 */
export async function logTimesheetEvent(
  admin: SupabaseClient,
  e: { timesheetId: string; actorId: string | null; action: TimesheetEventAction; reasonCode?: string | null; note?: string | null },
) {
  const { error } = await admin.from('timesheet_events').insert({
    timesheet_id: e.timesheetId,
    actor_id: e.actorId,
    action: e.action,
    reason_code: e.reasonCode ?? null,
    note: e.note ?? null,
  })
  if (error) console.error('logTimesheetEvent failed', e.action, error.message)
}
