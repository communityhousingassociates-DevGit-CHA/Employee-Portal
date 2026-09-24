'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole, requireSelfOrRole } from '@/lib/auth/session'
import { getOrCreateTimesheetForEmployee } from '@/lib/leave-timesheet'
import { getCurrentPeriod, getPreviousPeriod, getTimesheetDueDate } from '@/lib/pay-periods'
import { notifyApprovers, notifyEmployee } from '@/lib/notifications'
import { fmtDateRange } from '@/lib/format-date'
import { TIMESHEET_APPROVER_ROLES } from '@/lib/constants/approvals'
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
  // Once submitted (or approved) the sheet is locked — the reviewer must be looking at what the employee signed.
  const { data: current, error: statusError } = await admin.from('timesheets').select('status').eq('id', timesheetId).single()
  if (statusError) throw new Error(statusError.message)
  if (current.status !== 'draft') throw new Error('This timesheet has been submitted and can no longer be edited')
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
  const employee = await requireOwnTimesheet(timesheetId)
  const admin = createAdminClient()
  const { data: timesheet, error } = await admin
    .from('timesheets')
    .update({ status: 'submitted', employee_signed_at: new Date().toISOString(), return_reason: null })
    .eq('id', timesheetId)
    .select('period_start, period_end')
    .single()
  if (error) throw new Error(error.message)

  await notifyApprovers(admin, employee.id, TIMESHEET_APPROVER_ROLES, {
    title: `Timesheet from ${employee.name}`,
    body: `Pay period ${fmtDateRange(timesheet.period_start, timesheet.period_end)} was submitted and is waiting for your review.`,
  })

  revalidatePath('/timesheet')
  revalidatePath('/approvals')
}

/** Submitted timesheets awaiting review, oldest first. Never includes the caller's own — a timesheet can't be approved by its own author. */
export async function getPendingTimesheetApprovals() {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('timesheets')
    .select('*, employee:employees!timesheets_employee_id_fkey(name, employee_number), timesheet_rows(*)')
    .eq('status', 'submitted')
    .neq('employee_id', actor.id)
    .order('employee_signed_at')
  if (error) throw new Error(error.message)
  return (data ?? []).map(t => {
    const emp = t.employee as unknown as { name: string } | { name: string }[]
    const rows = ((t.timesheet_rows ?? []) as { work_date: string; regular_hours: number; leave_hours: number; description: string | null }[])
      .slice()
      .sort((a, b) => a.work_date.localeCompare(b.work_date))
    return { ...t, timesheet_rows: rows, employee_name: (Array.isArray(emp) ? emp[0]?.name : emp?.name) ?? 'Unknown' }
  })
}

async function getSubmittedTimesheet(admin: ReturnType<typeof createAdminClient>, id: string, actorId: string) {
  const { data, error } = await admin.from('timesheets').select('status, employee_id, period_start, period_end').eq('id', id).single()
  if (error) throw new Error(error.message)
  if (data.employee_id === actorId) throw new Error("You can't review your own timesheet — another approver needs to.")
  if (data.status !== 'submitted') throw new Error('This timesheet is no longer awaiting review')
  return data
}

export async function approveTimesheet(id: string) {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const admin = createAdminClient()
  const timesheet = await getSubmittedTimesheet(admin, id, actor.id)
  const { error } = await admin
    .from('timesheets')
    .update({ status: 'approved', approver_id: actor.id, approved_at: new Date().toISOString(), return_reason: null })
    .eq('id', id)
  if (error) throw new Error(error.message)

  await notifyEmployee(admin, timesheet.employee_id, {
    kind: 'approved',
    title: 'Your timesheet was approved',
    body: `Pay period ${fmtDateRange(timesheet.period_start, timesheet.period_end)}\nApproved by ${actor.name}.`,
    link: '/timesheet',
    cta: 'View Timesheet',
  })

  revalidatePath('/approvals')
  revalidatePath('/timesheet')
}

/**
 * Denies a submitted timesheet by sending it back for correction: status returns
 * to 'draft' so the employee can edit and resubmit, and the reason is shown to
 * them on the timesheet. A reason is required — they need to know what to fix.
 */
export async function returnTimesheet(id: string, reason: string) {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const trimmed = reason.trim()
  if (!trimmed) throw new Error('Add a reason so the employee knows what to correct')
  const admin = createAdminClient()
  const timesheet = await getSubmittedTimesheet(admin, id, actor.id)
  const { error } = await admin
    .from('timesheets')
    .update({ status: 'draft', approver_id: actor.id, approved_at: null, return_reason: trimmed })
    .eq('id', id)
  if (error) throw new Error(error.message)

  await notifyEmployee(admin, timesheet.employee_id, {
    kind: 'returned',
    title: 'Your timesheet was returned for correction',
    body: `Pay period ${fmtDateRange(timesheet.period_start, timesheet.period_end)}\nReturned by ${actor.name}.\nReason: ${trimmed}\nPlease fix it and resubmit.`,
    link: '/timesheet',
    cta: 'Open Timesheet',
  })

  revalidatePath('/approvals')
  revalidatePath('/timesheet')
}

export type TimesheetReminder = { periodStart: string; periodEnd: string; due: string; daysUntil: number } | null

/**
 * Whichever period's submission cutoff is 1–2 days out and still
 * unsubmitted, or null. Read-only (uses getTimesheetForEmployeePeriod, never
 * getOrCreateTimesheet) since this runs in the portal layout on every page
 * load — it must never silently create a draft timesheet just by rendering
 * the topbar alert.
 *
 * The cutoff (period end + 2 days) usually falls inside the *next* period's
 * date range, so "1 day out" often means checking the previous period, not
 * whichever period contains today.
 */
export async function getTimesheetReminderStatus(): Promise<TimesheetReminder> {
  const employee = await getCurrentEmployee()
  if (!employee) return null

  const todayStr = new Date().toISOString().slice(0, 10)
  if (employee.timesheet_reminder_dismissed_at?.slice(0, 10) === todayStr) return null

  const period = getCurrentPeriod()
  const previousPeriod = getPreviousPeriod()
  const [{ timesheet }, { timesheet: previousTimesheet }] = await Promise.all([
    getTimesheetForEmployeePeriod(employee.id, period.start, period.end),
    getTimesheetForEmployeePeriod(employee.id, previousPeriod.start, previousPeriod.end),
  ])

  const daysUntil = (dateStr: string) =>
    Math.round((new Date(`${dateStr}T00:00:00Z`).getTime() - new Date(`${todayStr}T00:00:00Z`).getTime()) / 86400000)

  const currentDue = getTimesheetDueDate(period)
  const previousDue = getTimesheetDueDate(previousPeriod)
  const currentDaysUntilDue = daysUntil(currentDue)
  const previousDaysUntilDue = daysUntil(previousDue)
  const previousUnsubmitted = employee.hire_date <= previousPeriod.end && (!previousTimesheet || previousTimesheet.status === 'draft')
  const currentUnsubmitted = !timesheet || timesheet.status === 'draft'

  if (previousUnsubmitted && (previousDaysUntilDue === 1 || previousDaysUntilDue === 2)) {
    return { periodStart: previousPeriod.start, periodEnd: previousPeriod.end, due: previousDue, daysUntil: previousDaysUntilDue }
  }
  if (currentUnsubmitted && (currentDaysUntilDue === 1 || currentDaysUntilDue === 2)) {
    return { periodStart: period.start, periodEnd: period.end, due: currentDue, daysUntil: currentDaysUntilDue }
  }
  return null
}

/** Dismisses the topbar timesheet alert for today only — a fresh reminder can still show tomorrow. */
export async function dismissTimesheetReminder() {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ timesheet_reminder_dismissed_at: new Date().toISOString() }).eq('id', employee.id)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}
