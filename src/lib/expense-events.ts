// Audit log for expenses. Deliberately NOT a 'use server' file — every export from one of those becomes a directly callable
// server action, and this writes on behalf of an already-authorized action.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExpenseEvent, ExpenseEventAction } from '@/types'

/**
 * Appends a row to expense_events, snapshotting the actor's name and role. Best-effort: the change it describes has already
 * happened, so a logging failure is reported to the server log rather than thrown (which would make a successful approval
 * look failed).
 */
export async function logExpenseEvent(
  admin: SupabaseClient,
  e: { expenseId: string; action: ExpenseEventAction; actor: { id: string; name: string; role: string }; note?: string | null; reasonCode?: string },
) {
  const { error } = await admin.from('expense_events').insert({
    expense_id: e.expenseId,
    action: e.action,
    actor_id: e.actor.id,
    actor_name: e.actor.name,
    actor_role: e.actor.role,
    note: e.note ?? null,
    reason_code: e.reasonCode ?? null,
  })
  if (error) console.error('logExpenseEvent failed', e.action, error.message)
}

/** Event history for a set of expenses, oldest first, keyed by expense id. */
export async function loadExpenseEvents(admin: SupabaseClient, expenseIds: string[]): Promise<Map<string, ExpenseEvent[]>> {
  const out = new Map<string, ExpenseEvent[]>()
  if (expenseIds.length === 0) return out
  const { data, error } = await admin
    .from('expense_events')
    .select('id, expense_id, action, actor_id, actor_name, actor_role, reason_code, note, backfilled, created_at')
    .in('expense_id', expenseIds)
    .order('created_at')
  if (error) throw new Error(error.message)
  for (const ev of data ?? []) {
    const list = out.get(ev.expense_id) ?? []
    list.push(ev as ExpenseEvent)
    out.set(ev.expense_id, list)
  }
  return out
}
