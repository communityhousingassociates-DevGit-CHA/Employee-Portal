// Leave-balance bookkeeping that runs on the server. Not a 'use server' file: these write balances for arbitrary
// employees and must only run behind an authorised caller (an approval action, or the daily cron).

import type { SupabaseClient } from '@supabase/supabase-js'
import { deductThroughDate } from '@/lib/pay-periods'
import { balanceTypeFor, type ReservedLeave } from '@/lib/leave-projection'
import { notifyApprovers, notifyEmployee } from '@/lib/notifications'
import { LEAVE_EXPENSE_APPROVER_ROLES } from '@/lib/constants/approvals'
import { fmtDate } from '@/lib/format-date'
import type { LeaveType } from '@/types'

const COLUMN = { pto: 'pto_hours', sick: 'sick_hours', vacation: 'personal_hours' } as const

/** Everything the projection needs about one employee: approved leave still waiting to come off the balance, and whether accruals run. */
export async function loadProjectionContext(admin: SupabaseClient, employeeId: string) {
  const [{ data: emp, error: empError }, { data: settings }, { data: reserved, error: resError }] = await Promise.all([
    admin.from('employees').select('hire_date, pto_uncapped').eq('id', employeeId).single(),
    admin.from('accrual_settings').select('enabled').maybeSingle(),
    admin.from('leave_requests').select('id, leave_type, start_date, hours').eq('employee_id', employeeId).eq('status', 'approved').is('balance_deducted_at', null),
  ])
  if (empError) throw new Error(empError.message)
  if (resError) throw new Error(resError.message)
  return {
    hireDate: emp.hire_date as string,
    ptoUncapped: !!emp.pto_uncapped,
    accrualsOn: !!settings?.enabled,
    reserved: (reserved ?? [])
      .filter(r => balanceTypeFor(r.leave_type as LeaveType) !== null)
      .map(r => ({ id: r.id as string, leave_type: r.leave_type as LeaveType, start_date: r.start_date as string, hours: Number(r.hours) })) as ReservedLeave[],
  }
}

/**
 * Takes a request's hours off the employee's balance and stamps it deducted. Returns the new balance. Callers decide
 * whether a shortfall is allowed (approval refuses; the date-based job deducts and raises a flag).
 */
export async function deductRequestFromBalance(admin: SupabaseClient, request: { id: string; employee_id: string; leave_type: LeaveType; hours: number }): Promise<{ newBalance: number } | null> {
  const type = balanceTypeFor(request.leave_type)
  if (!type) return null
  const col = COLUMN[type]
  const { data: balance, error } = await admin.from('leave_balances').select('*').eq('employee_id', request.employee_id).maybeSingle()
  if (error) throw new Error(error.message)
  const newBalance = Math.round((Number(balance?.[col] ?? 0) - Number(request.hours)) * 100) / 100
  const { error: upError } = await admin.from('leave_balances').update({ [col]: newBalance }).eq('employee_id', request.employee_id)
  if (upError) throw new Error(upError.message)
  const { error: stampError } = await admin.from('leave_requests').update({ balance_deducted_at: new Date().toISOString() }).eq('id', request.id)
  if (stampError) throw new Error(stampError.message)
  return { newBalance }
}

/**
 * Deducts approved leave whose start date has arrived or is within the next two pay periods (see DEDUCT_AHEAD_PERIODS). If
 * the balance can't cover it then, the hours are still
 * taken (the balance goes negative) and the employee and approvers are told — the reservation was only valid if the
 * projected balance actually materialised.
 */
export async function applyDueLeaveDeductions(admin: SupabaseClient): Promise<{ deducted: number; shortfalls: number }> {
  const through = deductThroughDate()
  const { data, error } = await admin
    .from('leave_requests')
    .select('id, employee_id, leave_type, start_date, end_date, hours')
    .eq('status', 'approved')
    .is('balance_deducted_at', null)
    .in('leave_type', ['PTO', 'Sick', 'Personal'])
    .lte('start_date', through)
    .order('start_date')
  if (error) throw new Error(error.message)

  let deducted = 0
  let shortfalls = 0
  for (const r of data ?? []) {
    try {
      const res = await deductRequestFromBalance(admin, r as { id: string; employee_id: string; leave_type: LeaveType; hours: number })
      if (!res) continue
      deducted++
      if (res.newBalance < 0) {
        shortfalls++
        const label = `${r.leave_type} leave starting ${fmtDate(r.start_date)} (${r.hours} hrs)`
        await notifyEmployee(admin, r.employee_id, {
          kind: 'returned',
          title: 'Leave started with an insufficient balance',
          body: `${label} was approved against a projected balance that wasn't there once the leave came due, so your balance is now ${Number(res.newBalance.toFixed(2))} hrs. Contact your Accounting Manager.`,
          link: '/dashboard',
          cta: 'View My Balances',
        })
        await notifyApprovers(admin, r.employee_id, LEAVE_EXPENSE_APPROVER_ROLES, {
          title: 'Approved leave exceeded the available balance',
          body: `${label} left the balance at ${Number(res.newBalance.toFixed(2))} hrs. The projected accruals it depended on weren't there when the leave came due.`,
        })
      }
    } catch (e) {
      console.error('applyDueLeaveDeductions: failed for request', r.id, e)
    }
  }
  return { deducted, shortfalls }
}
