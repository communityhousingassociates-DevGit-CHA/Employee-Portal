'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireSelfOrRole } from '@/lib/auth/session'
import type { Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

function weekdaysInPeriod(start: string, end: string): string[] {
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

async function requireOwnTimesheet(timesheetId: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data: timesheet, error } = await admin.from('timesheets').select('employee_id').eq('id', timesheetId).single()
  if (error) throw new Error(error.message)
  if (timesheet.employee_id !== employee.id) throw new Error('Forbidden')
  return employee
}

export async function getOrCreateTimesheet(periodStart: string, periodEnd: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()

  const { data: existing, error: findError } = await admin
    .from('timesheets')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('period_start', periodStart)
    .maybeSingle()
  if (findError) throw new Error(findError.message)

  let timesheet = existing
  if (!timesheet) {
    const { data: created, error: createError } = await admin
      .from('timesheets')
      .insert({ employee_id: employee.id, period_start: periodStart, period_end: periodEnd, status: 'draft' })
      .select('*')
      .single()
    if (createError) throw new Error(createError.message)
    timesheet = created

    // Salaried employees (those with a current salary record) default to 8 hrs/day so a
    // full two-week timesheet totals 80 hrs automatically. It's on the employee to lower
    // regular_hours and log leave_hours instead on days they took sick/PTO/other time off,
    // so PTO balances stay accurate. Hourly employees (no salary record) start at 0.
    const { data: currentSalary, error: salaryError } = await admin
      .from('employee_current_salary')
      .select('employee_id')
      .eq('employee_id', employee.id)
      .maybeSingle()
    if (salaryError) throw new Error(salaryError.message)
    const defaultRegularHours = currentSalary ? 8 : 0

    const rows = weekdaysInPeriod(periodStart, periodEnd).map(work_date => ({
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

  return { timesheet, rows: rows ?? [] }
}

/**
 * Read-only lookup for drilling into someone else's timesheet (Employees
 * roster detail view). Self access always allowed; viewing another
 * employee requires a manager-tier role. Never creates a row — unlike
 * getOrCreateTimesheet, a manager looking at a past period an employee
 * never filled in should just see "no timesheet", not silently generate
 * one for them.
 */
export async function getTimesheetForEmployeePeriod(employeeId: string, periodStart: string, periodEnd: string) {
  await requireSelfOrRole(employeeId, MANAGER_ROLES)
  const admin = createAdminClient()

  const { data: timesheet, error: findError } = await admin
    .from('timesheets')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('period_start', periodStart)
    .maybeSingle()
  if (findError) throw new Error(findError.message)
  if (!timesheet) return { timesheet: null, rows: [] }

  const { data: rows, error: rowsFetchError } = await admin
    .from('timesheet_rows')
    .select('*')
    .eq('timesheet_id', timesheet.id)
    .order('work_date')
  if (rowsFetchError) throw new Error(rowsFetchError.message)

  return { timesheet, rows: rows ?? [] }
}

export async function saveTimesheetDraft(
  timesheetId: string,
  rows: { id: string; description: string | null; regular_hours: number; leave_hours: number }[]
) {
  await requireOwnTimesheet(timesheetId)
  const admin = createAdminClient()
  for (const row of rows) {
    const { error } = await admin
      .from('timesheet_rows')
      .update({ description: row.description, regular_hours: row.regular_hours, leave_hours: row.leave_hours })
      .eq('id', row.id)
      .eq('timesheet_id', timesheetId)
    if (error) throw new Error(error.message)
  }
  revalidatePath('/timesheet')
}

export async function submitTimesheet(timesheetId: string) {
  await requireOwnTimesheet(timesheetId)
  const admin = createAdminClient()
  const { error } = await admin
    .from('timesheets')
    .update({ status: 'submitted', employee_signed_at: new Date().toISOString() })
    .eq('id', timesheetId)
  if (error) throw new Error(error.message)
  revalidatePath('/timesheet')
}
