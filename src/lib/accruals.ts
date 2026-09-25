// PTO / sick accrual engine, shared by the daily cron and the "run now" button. Not a 'use server' file: it writes
// balances for many employees and must only run behind an authorised caller (cron secret or payroll-access user).

import type { SupabaseClient } from '@supabase/supabase-js'
import { calcTier, SICK_RATE_PER_PERIOD, PTO_CARRYOVER_CAP } from '@/lib/constants/accrual'
import { getCurrentPeriod, getPayPeriods } from '@/lib/pay-periods'

export type AccrualRunSummary = { periods: string[]; processed: number; skipped: number; errors: string[] }

/**
 * Credits PTO and sick hours for every pay period from `firstPeriodStart` through the current one that hasn't been
 * credited yet. Idempotent: accrual_log records (employee, type, period), so re-running — or a missed day — never
 * double-credits or skips a period. Employees are only credited for periods that started on/after their hire date.
 */
export async function runAccruals(admin: SupabaseClient, firstPeriodStart: string, now: Date = new Date()): Promise<AccrualRunSummary> {
  const current = getCurrentPeriod(undefined, now)
  const summary: AccrualRunSummary = { periods: [], processed: 0, skipped: 0, errors: [] }
  if (firstPeriodStart > current.start) return summary

  // Every period start from firstPeriodStart up to (and including) the current period.
  const count = Math.round((Date.parse(`${current.start}T00:00:00Z`) - Date.parse(`${firstPeriodStart}T00:00:00Z`)) / (14 * 86400000)) + 1
  const periods = getPayPeriods(firstPeriodStart, Math.max(count, 1))

  const { data: employees, error: empError } = await admin.from('employees').select('id, hire_date, pto_uncapped').eq('is_active', true)
  if (empError) { summary.errors.push(empError.message); return summary }

  for (const period of periods) {
    const { data: existingLog, error: logError } = await admin.from('accrual_log').select('employee_id, accrual_type').eq('period_start', period.start)
    if (logError) { summary.errors.push(logError.message); continue }
    const done = new Set((existingLog ?? []).map(l => `${l.employee_id}:${l.accrual_type}`))
    let creditedThisPeriod = 0

    for (const emp of employees ?? []) {
      if (emp.hire_date > period.end) continue // not employed yet
      if (done.has(`${emp.id}:pto`) && done.has(`${emp.id}:sick`)) { summary.skipped++; continue }

      const { ptoRate } = calcTier(emp.hire_date)
      const { data: balance, error: balError } = await admin.from('leave_balances').select('pto_hours, sick_hours').eq('employee_id', emp.id).maybeSingle()
      if (balError || !balance) { summary.errors.push(`${emp.id}: no leave_balances row (${balError?.message ?? 'not found'})`); continue }

      const newPto = emp.pto_uncapped ? Number(balance.pto_hours) + ptoRate : Math.min(Number(balance.pto_hours) + ptoRate, PTO_CARRYOVER_CAP)
      const newSick = Number(balance.sick_hours) + SICK_RATE_PER_PERIOD

      const logRows = []
      if (!done.has(`${emp.id}:pto`)) logRows.push({ employee_id: emp.id, accrual_type: 'pto', hours: ptoRate, period_start: period.start })
      if (!done.has(`${emp.id}:sick`)) logRows.push({ employee_id: emp.id, accrual_type: 'sick', hours: SICK_RATE_PER_PERIOD, period_start: period.start })
      const { error: insertError } = await admin.from('accrual_log').insert(logRows)
      if (insertError) { summary.errors.push(`${emp.id}: ${insertError.message}`); continue }

      const { error: updateError } = await admin.from('leave_balances').update({ pto_hours: newPto, sick_hours: newSick }).eq('employee_id', emp.id)
      if (updateError) { summary.errors.push(`${emp.id}: ${updateError.message}`); continue }
      summary.processed++
      creditedThisPeriod++
    }
    if (creditedThisPeriod > 0) summary.periods.push(period.start)
  }
  return summary
}
