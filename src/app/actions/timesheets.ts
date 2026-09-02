'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireSelfOrRole } from '@/lib/auth/session'
import { getOrCreateTimesheetForEmployee } from '@/lib/leave-timesheet'
import type { Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

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
  return getOrCreateTimesheetForEmployee(admin, employee.id, periodStart, periodEnd)
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
