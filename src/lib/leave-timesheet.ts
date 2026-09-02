// Shared logic for syncing approved leave requests onto timesheets.
//
// Deliberately NOT a 'use server' actions file: every export from one of
// those becomes a directly callable server action, and applyLeaveToTimesheets
// writes hours to an arbitrary employee's timesheet — it must only ever run
// as a side effect of an already-authorized action (approveLeaveRequest),
// never as its own public endpoint.

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPeriod } from '@/lib/pay-periods'
import type { LeaveType, TimesheetRow } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

const SALARIED_DAILY_HOURS = 8

export function weekdaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  while (d <= endDate) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) days.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

export async function getOrCreateTimesheetForEmployee(admin: AdminClient, employeeId: string, periodStart: string, periodEnd: string) {
  const { data: existing, error: findError } = await admin
    .from('timesheets')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('period_start', periodStart)
    .maybeSingle()
  if (findError) throw new Error(findError.message)

  let timesheet = existing
  if (!timesheet) {
    const { data: created, error: createError } = await admin
      .from('timesheets')
      .insert({ employee_id: employeeId, period_start: periodStart, period_end: periodEnd, status: 'draft' })
      .select('*')
      .single()
    if (createError) throw new Error(createError.message)
    timesheet = created

    const defaultRegularHours = (await isSalariedEmployee(admin, employeeId)) ? SALARIED_DAILY_HOURS : 0

    const rows = weekdaysBetween(periodStart, periodEnd).map(work_date => ({
      timesheet_id: timesheet!.id,
      work_date,
      description: null,
      regular_hours: defaultRegularHours,
      leave_hours: 0,
      leave_type: null,
    }))
    const { error: rowsError } = await admin.from('timesheet_rows').insert(rows)
    if (rowsError) throw new Error(rowsError.message)
  }

  const { data: rows, error: rowsFetchError } = await admin
    .from('timesheet_rows')
    .select('*')
    .eq('timesheet_id', timesheet.id)
    .order('work_date')
  if (rowsFetchError) throw new Error(rowsFetchError.message)

  return { timesheet, rows: (rows ?? []) as TimesheetRow[] }
}

export async function isSalariedEmployee(admin: AdminClient, employeeId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('employee_current_salary')
    .select('employee_id')
    .eq('employee_id', employeeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

/**
 * Splits a leave request's total hours across the weekdays in its date
 * range, filling each day up to a full 8-hr day before moving to the next.
 * A request spanning only a weekend produces no allocations.
 */
export function distributeLeaveHours(startDate: string, endDate: string, totalHours: number): { date: string; hours: number }[] {
  const days = weekdaysBetween(startDate, endDate)
  let remaining = totalHours
  const allocations: { date: string; hours: number }[] = []
  for (const date of days) {
    if (remaining <= 0) break
    const amt = Math.min(SALARIED_DAILY_HOURS, remaining)
    allocations.push({ date, hours: amt })
    remaining -= amt
  }
  return allocations
}

/**
 * Writes an approved leave request's per-day hours onto the employee's
 * timesheet(s), creating a timesheet for any pay period they haven't
 * opened yet. Overwrites (not adds to) leave_hours for each day — the
 * approved request is the authoritative source for that day once decided.
 * For salaried employees, regular_hours is kept in sync (8 - leave_hours),
 * mirroring the same invariant the timesheet UI enforces client-side.
 */
export async function applyLeaveToTimesheets(
  admin: AdminClient,
  employeeId: string,
  leaveType: LeaveType,
  allocations: { date: string; hours: number }[]
) {
  if (allocations.length === 0) return
  const isSalaried = await isSalariedEmployee(admin, employeeId)

  for (const { date, hours } of allocations) {
    const period = getCurrentPeriod(undefined, new Date(`${date}T00:00:00Z`))
    const { rows } = await getOrCreateTimesheetForEmployee(admin, employeeId, period.start, period.end)
    const row = rows.find(r => r.work_date === date)
    if (!row) continue

    const leave_hours = Math.min(SALARIED_DAILY_HOURS, hours)
    const regular_hours = isSalaried ? SALARIED_DAILY_HOURS - leave_hours : row.regular_hours

    const { error } = await admin
      .from('timesheet_rows')
      .update({ leave_hours, leave_type: leaveType, regular_hours })
      .eq('id', row.id)
    if (error) throw new Error(error.message)
  }
}
