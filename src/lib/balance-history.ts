// Reconstructs leave balances as of a past date from the live balance and the events recorded since. Not a 'use server'
// file — it reads every employee's balances and must only run behind an authorised caller.

import type { SupabaseClient } from '@supabase/supabase-js'
import { balanceTypeFor } from '@/lib/leave-projection'
import type { LeaveType } from '@/types'

export type Buckets = { pto: number; sick: number; vacation: number }
const zero = (): Buckets => ({ pto: 0, sick: 0, vacation: 0 })
const round = (n: number) => Math.round(n * 100) / 100

export type BalanceAsOf = {
  employeeId: string
  asOf: Buckets
  live: Buckets
  /** What happened after `asOf` that moved the live balance: accruals credited, leave taken, manual adjustments. */
  since: { accrued: Buckets; leaveTaken: Buckets; adjustments: Buckets }
}

/**
 * balance as of D = live balance
 *                  + leave deducted for days AFTER D (it hadn't happened yet on D)
 *                  − leave that began on/before D but hasn't come off the balance yet
 *                  − accruals credited for periods starting AFTER D
 *                  − net manual adjustments effective AFTER D
 * (If balances were bulk-overridden from a file after D, that reset can't be unwound — the result is then approximate.)
 */
export async function balancesAsOf(admin: SupabaseClient, asOf: string, employeeIds?: string[]): Promise<Map<string, BalanceAsOf>> {
  let empQuery = admin.from('employees').select('id').eq('is_active', true)
  if (employeeIds) empQuery = empQuery.in('id', employeeIds)
  const [{ data: emps, error: e1 }, { data: balances, error: e2 }, { data: leave, error: e3 }, { data: accruals, error: e4 }, { data: adjustments, error: e5 }] = await Promise.all([
    empQuery,
    admin.from('leave_balances').select('employee_id, pto_hours, sick_hours, personal_hours'),
    admin.from('leave_requests').select('employee_id, leave_type, start_date, hours, balance_deducted_at').eq('status', 'approved').in('leave_type', ['PTO', 'Sick', 'Personal']),
    admin.from('accrual_log').select('employee_id, accrual_type, hours, period_start').gt('period_start', asOf),
    admin.from('balance_adjustments').select('employee_id, old_pto, old_sick, old_personal, new_pto, new_sick, new_personal').eq('kind', 'adjustment').gt('as_of', asOf),
  ])
  for (const e of [e1, e2, e3, e4, e5]) if (e) throw new Error(e.message)

  const out = new Map<string, BalanceAsOf>()
  const live = new Map((balances ?? []).map(b => [b.employee_id as string, { pto: Number(b.pto_hours), sick: Number(b.sick_hours), vacation: Number(b.personal_hours) }]))
  for (const emp of emps ?? []) {
    out.set(emp.id, { employeeId: emp.id, asOf: zero(), live: live.get(emp.id) ?? zero(), since: { accrued: zero(), leaveTaken: zero(), adjustments: zero() } })
  }

  for (const r of leave ?? []) {
    const rec = out.get(r.employee_id as string)
    const type = balanceTypeFor(r.leave_type as LeaveType)
    if (!rec || !type) continue
    const hours = Number(r.hours)
    if (r.balance_deducted_at && (r.start_date as string) > asOf) rec.since.leaveTaken[type] += hours // deducted, but after D
    else if (!r.balance_deducted_at && (r.start_date as string) <= asOf) rec.since.leaveTaken[type] -= hours // began by D, not yet deducted
  }
  for (const a of accruals ?? []) {
    const rec = out.get(a.employee_id as string)
    if (!rec) continue
    if (a.accrual_type === 'pto') rec.since.accrued.pto += Number(a.hours)
    else if (a.accrual_type === 'sick') rec.since.accrued.sick += Number(a.hours)
  }
  for (const a of adjustments ?? []) {
    const rec = out.get(a.employee_id as string)
    if (!rec) continue
    rec.since.adjustments.pto += Number(a.new_pto) - Number(a.old_pto ?? 0)
    rec.since.adjustments.sick += Number(a.new_sick) - Number(a.old_sick ?? 0)
    rec.since.adjustments.vacation += Number(a.new_personal) - Number(a.old_personal ?? 0)
  }

  for (const rec of out.values()) {
    for (const k of ['pto', 'sick', 'vacation'] as const) {
      rec.asOf[k] = round(rec.live[k] + rec.since.leaveTaken[k] - rec.since.accrued[k] - rec.since.adjustments[k])
      rec.since.leaveTaken[k] = round(rec.since.leaveTaken[k])
      rec.since.accrued[k] = round(rec.since.accrued[k])
      rec.since.adjustments[k] = round(rec.since.adjustments[k])
    }
  }
  return out
}
