'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
import { canViewTimesheetReports } from '@/lib/constants/salary-access'
import { getOrCreateTimesheetForEmployee } from '@/lib/leave-timesheet'
import { getCurrentPeriod, getPreviousPeriod, getTimesheetDueDate, getPayrollDueDate, periodLockReason, closedRangeOverlapping, type ClosedRange } from '@/lib/pay-periods'
import { loadClosedRanges } from '@/lib/period-lock'
import { logTimesheetEvent } from '@/lib/timesheet-events'
import { REOPEN_REASON_CODES, REOPEN_OVERRIDE_ROLES, reopenReasonLabel } from '@/lib/constants/timesheet-reopen'
import { notifyApprovers, notifyEmployee } from '@/lib/notifications'
import { fmtDate, fmtDateRange } from '@/lib/format-date'
import { TIMESHEET_APPROVER_ROLES, canSelfApprove } from '@/lib/constants/approvals'
import type { Role, Timesheet, TimesheetEventAction, TimesheetForReview } from '@/types'


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
  // Your own timesheet, always; anyone else's only for the named payroll viewers (Nico, Carrileen, super admin).
  const viewer = await getCurrentEmployee()
  if (!viewer || (viewer.id !== employeeId && !canViewTimesheetReports(viewer))) throw new Error('Forbidden')
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

/**
 * Checks hand-picked tag ids before they're saved: each must exist, and must be active unless the day already carries it
 * (so a retired tag can stay on old days but can't be newly applied). Returns the cleaned, de-duplicated ids per row.
 */
async function validateRowTags(admin: ReturnType<typeof createAdminClient>, timesheetId: string, rows: { id: string; tag_ids: string[] }[]) {
  const out = new Map<string, string[]>()
  if (rows.length === 0) return out
  const [{ data: tags, error: tagError }, { data: existing, error: rowError }] = await Promise.all([
    admin.from('timesheet_tags').select('id, is_active'),
    admin.from('timesheet_rows').select('id, tag_ids').eq('timesheet_id', timesheetId).in('id', rows.map(r => r.id)),
  ])
  if (tagError) throw new Error(tagError.message)
  if (rowError) throw new Error(rowError.message)
  const activeById = new Map((tags ?? []).map(t => [t.id as string, t.is_active as boolean]))
  const currentByRow = new Map((existing ?? []).map(r => [r.id as string, (r.tag_ids ?? []) as string[]]))
  for (const r of rows) {
    const ids = [...new Set(r.tag_ids)]
    for (const id of ids) {
      if (!activeById.has(id)) throw new Error('One of the selected tags no longer exists')
      if (!activeById.get(id) && !(currentByRow.get(r.id) ?? []).includes(id)) throw new Error('One of the selected tags has been retired and can no longer be applied')
    }
    out.set(r.id, ids)
  }
  return out
}

/**
 * An approver adjusting the hand-picked tags on one day of a SUBMITTED timesheet while reviewing it. Logged in the
 * timesheet's history. (Employees tag their own days through saveTimesheetDraft while it's still a draft.)
 */
export async function adjustRowTags(timesheetId: string, rowId: string, tagIds: string[]) {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const admin = createAdminClient()
  const timesheet = await getReviewableTimesheet(admin, timesheetId, actor, 'submitted')
  const tagIdsByRow = await validateRowTags(admin, timesheetId, [{ id: rowId, tag_ids: tagIds }])
  const cleaned = tagIdsByRow.get(rowId) ?? []

  const { data: row, error: rowError } = await admin.from('timesheet_rows').select('work_date').eq('id', rowId).eq('timesheet_id', timesheetId).single()
  if (rowError) throw new Error(rowError.message)
  const { error } = await admin.from('timesheet_rows').update({ tag_ids: cleaned }).eq('id', rowId).eq('timesheet_id', timesheetId)
  if (error) throw new Error(error.message)

  const { data: names } = cleaned.length ? await admin.from('timesheet_tags').select('name').in('id', cleaned) : { data: [] as { name: string }[] }
  await logTimesheetEvent(admin, {
    timesheetId, actorId: actor.id, action: 'tags_changed',
    note: `${fmtDate(row.work_date)}: ${(names ?? []).map(n => n.name).join(', ') || 'no tags'} (${fmtDateRange(timesheet.period_start, timesheet.period_end)})`,
  })
  revalidatePath('/approvals')
}

/**
 * Accounting closes out date ranges; a draft timesheet touching one can't be edited or submitted — unless it was
 * deliberately reopened by an approver/CEO (return_reason is set), which is how a CEO override lets corrections through.
 */
async function assertNotClosed(admin: ReturnType<typeof createAdminClient>, ts: { period_start: string; period_end: string; return_reason: string | null }) {
  if (ts.return_reason) return
  const hit = closedRangeOverlapping(ts.period_start, ts.period_end, await loadClosedRanges(admin))
  if (hit) {
    throw new Error(`This pay period was closed by accounting (${fmtDate(hit.start)} – ${fmtDate(hit.end)}), so its timesheet can no longer be changed. Contact your Accounting Manager.`)
  }
}

export async function saveTimesheetDraft(
  timesheetId: string,
  rows: { id: string; description: string | null; regular_hours: number; leave_hours: number; tag_ids?: string[] }[]
) {
  await requireOwnTimesheet(timesheetId)
  const admin = createAdminClient()
  // Once submitted (or approved) the sheet is locked — the reviewer must be looking at what the employee signed.
  const { data: current, error: statusError } = await admin.from('timesheets').select('status, period_start, period_end, return_reason').eq('id', timesheetId).single()
  if (statusError) throw new Error(statusError.message)
  if (current.status !== 'draft') throw new Error('This timesheet has been submitted and can no longer be edited')
  await assertNotClosed(admin, current)
  const tagIdsByRow = await validateRowTags(admin, timesheetId, rows.filter(r => r.tag_ids).map(r => ({ id: r.id, tag_ids: r.tag_ids! })))
  for (const row of rows) {
    const { error } = await admin
      .from('timesheet_rows')
      // Leave hours are never written from here — they come only from approved (or auto-approved sick) leave requests.
      .update({ description: row.description, regular_hours: row.regular_hours, ...(tagIdsByRow.has(row.id) ? { tag_ids: tagIdsByRow.get(row.id) } : {}) })
      .eq('id', row.id)
      .eq('timesheet_id', timesheetId)
    if (error) throw new Error(error.message)
  }
  revalidatePath('/timesheet')
}

export async function submitTimesheet(timesheetId: string) {
  const employee = await requireOwnTimesheet(timesheetId)
  const admin = createAdminClient()

  const { data: current, error: currentError } = await admin.from('timesheets').select('status, period_start, period_end, return_reason').eq('id', timesheetId).single()
  if (currentError) throw new Error(currentError.message)
  if (current.status !== 'draft') throw new Error('This timesheet has already been submitted')
  await assertNotClosed(admin, current)

  // Leave hours only appear on a timesheet once a request is decided, so submitting while one is still pending
  // would send in a timesheet with that leave missing. Get it decided first.
  const { data: pendingLeave, error: pendingError } = await admin
    .from('leave_requests')
    .select('leave_type, start_date, end_date')
    .eq('employee_id', employee.id)
    .eq('status', 'pending')
    .lte('start_date', current.period_end)
    .gte('end_date', current.period_start)
  if (pendingError) throw new Error(pendingError.message)
  if (pendingLeave && pendingLeave.length > 0) {
    const first = pendingLeave[0]
    const range = first.start_date === first.end_date ? fmtDate(first.start_date) : `${fmtDate(first.start_date)} – ${fmtDate(first.end_date)}`
    throw new Error(
      `You have ${pendingLeave.length === 1 ? 'a pending leave request' : `${pendingLeave.length} pending leave requests`} in this pay period (${first.leave_type}, ${range}). ` +
      `Ask your approver to decide ${pendingLeave.length === 1 ? 'it' : 'them'} first so the leave appears on this timesheet, then submit.`,
    )
  }

  const { data: timesheet, error } = await admin
    .from('timesheets')
    .update({ status: 'submitted', employee_signed_at: new Date().toISOString(), return_reason: null, correction_requested_at: null, correction_note: null })
    .eq('id', timesheetId)
    .select('period_start, period_end')
    .single()
  if (error) throw new Error(error.message)
  await logTimesheetEvent(admin, { timesheetId, actorId: employee.id, action: 'submitted' })

  await notifyApprovers(admin, employee.id, TIMESHEET_APPROVER_ROLES, {
    title: `Timesheet from ${employee.name}`,
    body: `Pay period ${fmtDateRange(timesheet.period_start, timesheet.period_end)} was submitted and is waiting for your review.`,
  })

  revalidatePath('/timesheet')
  revalidatePath('/approvals')
}

const PENDING_SELECT = '*, employee:employees!timesheets_employee_id_fkey(name, employee_number, employee_type), timesheet_rows(*), events:timesheet_events(*, actor:employees(name))'

type RawReviewRow = Timesheet & {
  employee: { name: string; employee_type: string } | { name: string; employee_type: string }[]
  timesheet_rows: TimesheetForReview['timesheet_rows'] | null
  events: { id: string; action: TimesheetEventAction; reason_code: string | null; note: string | null; created_at: string; actor: { name: string } | { name: string }[] | null }[] | null
}

function shapeTimesheet(t: RawReviewRow, closedRanges: ClosedRange[]): TimesheetForReview {
  const rows = (t.timesheet_rows ?? []).slice().sort((a, b) => a.work_date.localeCompare(b.work_date))
  const events = (t.events ?? [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(e => ({ id: e.id, action: e.action, reason_code: e.reason_code, note: e.note, created_at: e.created_at, actor_name: (Array.isArray(e.actor) ? e.actor[0]?.name : e.actor?.name) ?? null }))
  const { employee, ...rest } = t
  return {
    ...rest,
    timesheet_rows: rows,
    events,
    employee_name: (Array.isArray(employee) ? employee[0]?.name : employee?.name) ?? 'Unknown',
    employee_type: (Array.isArray(employee) ? employee[0]?.employee_type : employee?.employee_type) ?? '',
    payroll_due: getPayrollDueDate({ end: t.period_end }),
    lock_reason: periodLockReason({ start: t.period_start, end: t.period_end }, closedRanges),
  }
}

/** Submitted timesheets awaiting review, oldest first. The caller's own only appears if they're allowed to self-approve (see canSelfApprove). */
export async function getPendingTimesheetApprovals() {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const admin = createAdminClient()
  let query = admin.from('timesheets').select(PENDING_SELECT).eq('status', 'submitted')
  if (!canSelfApprove(actor.role)) query = query.neq('employee_id', actor.id)
  const { data, error } = await query.order('employee_signed_at')
  if (error) throw new Error(error.message)
  const ranges = await loadClosedRanges(admin)
  return (data ?? []).map(t => shapeTimesheet(t as unknown as RawReviewRow, ranges))
}

/**
 * Recently approved timesheets (last ~90 days) — the list an approver reopens from. Ones an employee has
 * asked to correct come first. Includes lock_reason so the UI knows whether reopening needs the CEO override.
 */
export async function getApprovedTimesheets() {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const admin = createAdminClient()
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  let query = admin.from('timesheets').select(PENDING_SELECT).eq('status', 'approved').gte('period_end', since)
  if (!canSelfApprove(actor.role)) query = query.neq('employee_id', actor.id)
  const { data, error } = await query.order('period_end', { ascending: false }).limit(60)
  if (error) throw new Error(error.message)
  const ranges = await loadClosedRanges(admin)
  const shaped = (data ?? []).map(t => shapeTimesheet(t as unknown as RawReviewRow, ranges))
  return shaped.sort((a, b) => Number(!!b.correction_requested_at) - Number(!!a.correction_requested_at))
}

async function getReviewableTimesheet(admin: ReturnType<typeof createAdminClient>, id: string, actor: { id: string; role: Role }, expected: 'submitted' | 'approved') {
  const { data, error } = await admin.from('timesheets').select('status, employee_id, period_start, period_end').eq('id', id).single()
  if (error) throw new Error(error.message)
  if (data.employee_id === actor.id && !canSelfApprove(actor.role)) throw new Error("You can't review your own timesheet — another approver needs to.")
  if (data.status !== expected) throw new Error(expected === 'submitted' ? 'This timesheet is no longer awaiting review' : 'Only an approved timesheet can be reopened this way')
  return data
}

export async function approveTimesheet(id: string) {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const admin = createAdminClient()
  const timesheet = await getReviewableTimesheet(admin, id, actor, 'submitted')
  const { error } = await admin
    .from('timesheets')
    .update({ status: 'approved', approver_id: actor.id, approved_at: new Date().toISOString(), return_reason: null, correction_requested_at: null, correction_note: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await logTimesheetEvent(admin, { timesheetId: id, actorId: actor.id, action: 'approved' })

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

function requireReason(reasonCode: string, note: string) {
  if (!REOPEN_REASON_CODES.some(c => c.value === reasonCode)) throw new Error('Choose a reason code')
  const trimmed = note.trim()
  if (!trimmed) throw new Error('Add notes explaining why')
  return trimmed
}

/**
 * Sends a SUBMITTED timesheet back for correction (the "deny" of a timesheet): status returns to 'draft' so the
 * employee can edit and resubmit. A reason code and notes are required and logged.
 */
export async function returnTimesheet(id: string, reasonCode: string, note: string) {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const trimmed = requireReason(reasonCode, note)
  const admin = createAdminClient()
  const timesheet = await getReviewableTimesheet(admin, id, actor, 'submitted')
  const returnLock = periodLockReason({ start: timesheet.period_start, end: timesheet.period_end }, await loadClosedRanges(admin))
  if (returnLock === 'closed' && !REOPEN_OVERRIDE_ROLES.includes(actor.role)) {
    throw new Error('Accounting has closed this period, so only the CEO can return it (CEO override).')
  }
  const reason = `${reopenReasonLabel(reasonCode)}: ${trimmed}`
  const { error } = await admin
    .from('timesheets')
    .update({ status: 'draft', approver_id: actor.id, approved_at: null, return_reason: reason, correction_requested_at: null, correction_note: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await logTimesheetEvent(admin, { timesheetId: id, actorId: actor.id, action: 'returned', reasonCode, note: trimmed })

  await notifyEmployee(admin, timesheet.employee_id, {
    kind: 'returned',
    title: 'Your timesheet was returned for correction',
    body: `Pay period ${fmtDateRange(timesheet.period_start, timesheet.period_end)}\nReturned by ${actor.name}.\nReason: ${reason}\nPlease fix it and resubmit.`,
    link: '/timesheet',
    cta: 'Open Timesheet',
  })

  revalidatePath('/approvals')
  revalidatePath('/timesheet')
}

/**
 * Reopens an APPROVED timesheet so the employee can correct it and resubmit (it then needs re-approval).
 *   * Before the payroll due date: any approver, with a reason code + notes.
 *   * After the payroll due date: only the CEO (the "CEO override"), same requirements, logged as an
 *     override so it stands out as a post-payroll adjustment.
 */
export async function reopenTimesheet(id: string, reasonCode: string, note: string) {
  const actor = await requireRole(TIMESHEET_APPROVER_ROLES)
  const trimmed = requireReason(reasonCode, note)
  const admin = createAdminClient()
  const timesheet = await getReviewableTimesheet(admin, id, actor, 'approved')

  const lockReason = periodLockReason({ start: timesheet.period_start, end: timesheet.period_end }, await loadClosedRanges(admin))
  const locked = lockReason !== null
  if (locked && !REOPEN_OVERRIDE_ROLES.includes(actor.role)) {
    throw new Error(lockReason === 'closed'
      ? 'Accounting has closed this period. Only the CEO can reopen it (CEO override).'
      : `Payroll for this period was due ${fmtDate(getPayrollDueDate({ end: timesheet.period_end }))}. Only the CEO can reopen it (CEO override).`)
  }

  const reason = `${reopenReasonLabel(reasonCode)}: ${trimmed}`
  const { error } = await admin
    .from('timesheets')
    .update({ status: 'draft', approver_id: actor.id, approved_at: null, return_reason: reason, correction_requested_at: null, correction_note: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await logTimesheetEvent(admin, { timesheetId: id, actorId: actor.id, action: locked ? 'override_reopened' : 'reopened', reasonCode, note: trimmed })

  await notifyEmployee(admin, timesheet.employee_id, {
    kind: 'returned',
    title: locked ? 'Your timesheet was reopened (post-payroll adjustment)' : 'Your approved timesheet was reopened',
    body: `Pay period ${fmtDateRange(timesheet.period_start, timesheet.period_end)}\nReopened by ${actor.name}.\nReason: ${reason}\nPlease make the correction and resubmit for approval.`,
    link: '/timesheet',
    cta: 'Open Timesheet',
  })

  revalidatePath('/approvals')
  revalidatePath('/timesheet')
}

/**
 * Employee asks for a submitted/approved timesheet to be reopened. Approvers are alerted; before the payroll due
 * date any approver can act on it, afterwards only the CEO (override).
 */
export async function requestTimesheetCorrection(timesheetId: string, note: string) {
  const employee = await requireOwnTimesheet(timesheetId)
  const trimmed = note.trim()
  if (!trimmed) throw new Error('Describe what needs to be corrected')
  const admin = createAdminClient()
  const { data: ts, error: tsError } = await admin.from('timesheets').select('status, period_start, period_end').eq('id', timesheetId).single()
  if (tsError) throw new Error(tsError.message)
  if (ts.status === 'draft') throw new Error('This timesheet is still open — you can edit it directly')

  const { error } = await admin
    .from('timesheets')
    .update({ correction_requested_at: new Date().toISOString(), correction_note: trimmed })
    .eq('id', timesheetId)
  if (error) throw new Error(error.message)
  await logTimesheetEvent(admin, { timesheetId, actorId: employee.id, action: 'correction_requested', reasonCode: 'employee_error', note: trimmed })

  const locked = periodLockReason({ start: ts.period_start, end: ts.period_end }, await loadClosedRanges(admin)) !== null
  await notifyApprovers(admin, employee.id, locked ? REOPEN_OVERRIDE_ROLES : TIMESHEET_APPROVER_ROLES, {
    title: `Correction requested: ${employee.name}`,
    body: `Pay period ${fmtDateRange(ts.period_start, ts.period_end)} (${ts.status})\n${trimmed}${locked ? '\nThis period is locked (closed by accounting or past payroll due) — a CEO override is needed to reopen it.' : ''}`,
  })

  revalidatePath('/timesheet')
  revalidatePath('/approvals')
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
