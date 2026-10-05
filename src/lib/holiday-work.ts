// Holiday work on an approved timesheet (SOP §4). Not a 'use server' file: it writes leave balances and must only run behind
// an approval action.
//
//   * Exempt employee: flex time = HOLIDAY_WORK_MULTIPLIER × hours worked on the holiday, credited to leave_balances.flex_hours.
//     flex_credits holds one row per (employee, date), so re-approving after a correction adjusts by the difference — it never
//     double-credits.
//   * Non-exempt employee: no flex time; the hours are paid at time-and-a-half. Payroll sees that on the Reports → Timesheets
//     view (holiday-worked hours and their time-and-a-half equivalent).

import { UserError } from '@/lib/user-error'
import type { SupabaseClient } from '@supabase/supabase-js'
import { holidayOn, type YearEndChoice } from '@/lib/holidays'
import { HOLIDAY_WORK_MULTIPLIER, holidayWorkedHours, round2 } from '@/lib/constants/holiday-work'

export async function creditHolidayFlex(admin: SupabaseClient, timesheetId: string, employeeId: string): Promise<{ credited: number }> {
  const { data: emp, error: empError } = await admin.from('employees').select('is_exempt, year_end_holiday').eq('id', employeeId).single()
  if (empError) throw new Error(empError.message)
  if (!emp.is_exempt) return { credited: 0 }

  const { data: rows, error: rowsError } = await admin.from('timesheet_rows').select('work_date, regular_hours, holiday_hours, holiday_worked_hours').eq('timesheet_id', timesheetId)
  if (rowsError) throw new Error(rowsError.message)
  const { data: existing, error: existingError } = await admin.from('flex_credits').select('id, work_date, hours_credited').eq('employee_id', employeeId).in('work_date', (rows ?? []).map(r => r.work_date as string))
  if (existingError) throw new Error(existingError.message)
  const creditByDate = new Map((existing ?? []).map(c => [c.work_date as string, c]))

  let delta = 0
  for (const r of rows ?? []) {
    const date = r.work_date as string
    const holiday = holidayOn(date, emp.year_end_holiday as YearEndChoice | null)
    const worked = holidayWorkedHours(r, !!holiday)
    const target = round2(worked * HOLIDAY_WORK_MULTIPLIER)
    const prior = creditByDate.get(date)
    const priorHours = prior ? Number(prior.hours_credited) : 0
    if (target === priorHours) continue
    if (prior) {
      const { error } = await admin.from('flex_credits').update({ timesheet_id: timesheetId, hours_worked: worked, hours_credited: target }).eq('id', prior.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await admin.from('flex_credits').insert({ employee_id: employeeId, timesheet_id: timesheetId, work_date: date, hours_worked: worked, hours_credited: target })
      if (error) throw new Error(error.message)
    }
    delta = round2(delta + target - priorHours)
  }

  if (delta !== 0) {
    const { data: bal, error: balError } = await admin.from('leave_balances').select('flex_hours').eq('employee_id', employeeId).maybeSingle()
    if (balError) throw new Error(balError.message)
    if (!bal) throw new UserError('No leave_balances row for this employee — flex time could not be credited.')
    const { error } = await admin.from('leave_balances').update({ flex_hours: round2(Number(bal.flex_hours ?? 0) + delta) }).eq('employee_id', employeeId)
    if (error) throw new Error(error.message)
  }
  return { credited: delta }
}
