// Shared logic for syncing approved leave requests onto timesheets.
//
// Deliberately NOT a 'use server' actions file: every export from one of
// those becomes a directly callable server action, and applyLeaveToTimesheets
// writes hours to an arbitrary employee's timesheet — it must only ever run
// as a side effect of an already-authorized action (approveLeaveRequest),
// never as its own public endpoint.

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPeriod, periodLockReason } from '@/lib/pay-periods'
import { loadClosedRanges } from '@/lib/period-lock'
import { holidayOn } from '@/lib/holidays'
import { logTimesheetEvent } from '@/lib/timesheet-events'
import type { LeaveType, TimesheetRow } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

const SALARIED_DAILY_HOURS = 8

// Default day descriptions, so a fresh timesheet is self-explanatory and holiday time is easy to spot.
export const REGULAR_DESCRIPTION = 'Regular Hours'
export const HOLIDAY_DESCRIPTION = 'Holiday Hours'

function leaveDescription(leaveType: LeaveType): string {
  return leaveType === 'Personal' ? 'Vacation' : leaveType === 'Sick' ? 'Sick Leave' : leaveType
}

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

/** Weekdays in the range that are not scheduled holidays — the days leave can actually be taken. */
export function workdaysBetween(start: string, end: string): string[] {
  return weekdaysBetween(start, end).filter(d => !holidayOn(d))
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

    // Salaried employees get Regular hours on every workday and Holiday hours (instead of Regular) on scheduled holidays.
    const salaried = await isSalariedEmployee(admin, employeeId)
    const defaultDailyHours = salaried ? SALARIED_DAILY_HOURS : 0

    const rows = weekdaysBetween(periodStart, periodEnd).map(work_date => {
      const holiday = holidayOn(work_date)
      return {
        timesheet_id: timesheet!.id,
        work_date,
        description: holiday ? HOLIDAY_DESCRIPTION : REGULAR_DESCRIPTION,
        regular_hours: holiday ? 0 : defaultDailyHours,
        leave_hours: 0,
        holiday_hours: holiday ? defaultDailyHours : 0,
        leave_type: null,
      }
    })
    const { error: rowsError } = await admin.from('timesheet_rows').insert(rows)
    if (rowsError) throw new Error(rowsError.message)
  }

  const { data: fetched, error: rowsFetchError } = await admin
    .from('timesheet_rows')
    .select('*')
    .eq('timesheet_id', timesheet.id)
    .order('work_date')
  if (rowsFetchError) throw new Error(rowsFetchError.message)
  let rows = (fetched ?? []) as TimesheetRow[]

  // Timesheets created before these defaults existed get them filled in on first view — drafts only, so a
  // submitted/approved (signed) timesheet is never altered behind the employee's back.
  if (timesheet.status === 'draft') rows = await applyDayDefaults(admin, employeeId, rows)

  return { timesheet, rows }
}

/**
 * Fills the standard defaults into an existing DRAFT timesheet's rows: an untouched (null) description becomes
 * "Regular Hours" / "Holiday Hours", and a scheduled holiday still carrying default Regular hours is converted
 * to Holiday hours (salaried only). A description the employee cleared on purpose ('') is left alone.
 */
async function applyDayDefaults(admin: AdminClient, employeeId: string, rows: TimesheetRow[]): Promise<TimesheetRow[]> {
  const needs = rows.some(r => {
    const holiday = holidayOn(r.work_date)
    return r.description === null || (holiday && r.description === holiday) ||
      (!!holiday && Number(r.holiday_hours ?? 0) === 0 && Number(r.leave_hours) === 0 && Number(r.regular_hours) > 0)
  })
  if (!needs) return rows
  const salaried = await isSalariedEmployee(admin, employeeId)

  const out: TimesheetRow[] = []
  for (const r of rows) {
    const holiday = holidayOn(r.work_date)
    const patch: Partial<TimesheetRow> = {}
    if (r.description === null || (holiday && r.description === holiday)) patch.description = holiday ? HOLIDAY_DESCRIPTION : REGULAR_DESCRIPTION
    if (holiday && salaried && Number(r.holiday_hours ?? 0) === 0 && Number(r.leave_hours) === 0 && Number(r.regular_hours) > 0) {
      patch.regular_hours = 0
      patch.holiday_hours = SALARIED_DAILY_HOURS
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from('timesheet_rows').update(patch).eq('id', r.id)
      if (error) throw new Error(error.message)
      out.push({ ...r, ...patch })
    } else out.push(r)
  }
  return out
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
  const days = workdaysBetween(startDate, endDate)
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

export type LeavePostingSummary = {
  /** Submitted/approved timesheets (payroll not yet due) that were reopened to draft so the new leave can be reviewed and resubmitted. */
  reopened: { timesheetId: string; periodStart: string; periodEnd: string; wasApproved: boolean }[]
  /** Timesheets in a period accounting has closed — leave was NOT written; a CEO override is needed if pay must change. */
  held: { timesheetId: string; periodStart: string; periodEnd: string }[]
}

/**
 * Writes an approved leave request's per-day hours onto the employee's
 * timesheet(s), creating a timesheet for any pay period they haven't
 * opened yet. Overwrites (not adds to) leave_hours for each day — the
 * approved request is the authoritative source for that day once decided.
 * For salaried employees, regular_hours is kept in sync (8 - leave_hours),
 * mirroring the same invariant the timesheet UI enforces client-side.
 *
 * Locking rules ("late leave"): a draft timesheet is simply updated. A submitted or approved timesheet whose
 * period is open is updated AND reopened to draft (reason code leave_change, logged) so it is re-reviewed
 * before pay. Once accounting has closed the period, the timesheet is left untouched and reported as `held`.
 */
export async function applyLeaveToTimesheets(
  admin: AdminClient,
  employeeId: string,
  leaveType: LeaveType,
  allocations: { date: string; hours: number }[],
  ctx: { actorId: string | null; leaveLabel: string } = { actorId: null, leaveLabel: leaveType },
): Promise<LeavePostingSummary> {
  const summary: LeavePostingSummary = { reopened: [], held: [] }
  if (allocations.length === 0) return summary
  const isSalaried = await isSalariedEmployee(admin, employeeId)
  const closedRanges = await loadClosedRanges(admin)
  const reopenIds = new Set<string>()
  const heldIds = new Set<string>()

  for (const { date, hours } of allocations) {
    const period = getCurrentPeriod(undefined, new Date(`${date}T00:00:00Z`))
    const { timesheet, rows } = await getOrCreateTimesheetForEmployee(admin, employeeId, period.start, period.end)
    const row = rows.find(r => r.work_date === date)
    if (!row) continue

    if (timesheet.status !== 'draft') {
      if (periodLockReason(period, closedRanges)) {
        if (!heldIds.has(timesheet.id)) {
          heldIds.add(timesheet.id)
          summary.held.push({ timesheetId: timesheet.id, periodStart: period.start, periodEnd: period.end })
        }
        continue
      }
      if (!reopenIds.has(timesheet.id)) {
        reopenIds.add(timesheet.id)
        summary.reopened.push({ timesheetId: timesheet.id, periodStart: period.start, periodEnd: period.end, wasApproved: timesheet.status === 'approved' })
      }
    }

    const leave_hours = Math.min(SALARIED_DAILY_HOURS, hours)
    const regular_hours = isSalaried ? SALARIED_DAILY_HOURS - leave_hours - Number(row.holiday_hours ?? 0) : row.regular_hours

    // A full day of leave shouldn't still say "Regular Hours".
    const description = leave_hours >= SALARIED_DAILY_HOURS && (row.description === null || row.description === REGULAR_DESCRIPTION) ? leaveDescription(leaveType) : row.description
    const { error } = await admin
      .from('timesheet_rows')
      .update({ leave_hours, leave_type: leaveType, regular_hours, description })
      .eq('id', row.id)
    if (error) throw new Error(error.message)
  }

  const note = `${ctx.leaveLabel} was added to this pay period. Review your entries and resubmit.`
  for (const r of summary.reopened) {
    const { error } = await admin
      .from('timesheets')
      .update({ status: 'draft', approver_id: null, approved_at: null, return_reason: `Leave added or changed: ${note}`, correction_requested_at: null, correction_note: null })
      .eq('id', r.timesheetId)
    if (error) throw new Error(error.message)
    await logTimesheetEvent(admin, { timesheetId: r.timesheetId, actorId: ctx.actorId, action: 'leave_reopened', reasonCode: 'leave_change', note })
  }
  for (const h of summary.held) {
    await logTimesheetEvent(admin, {
      timesheetId: h.timesheetId, actorId: ctx.actorId, action: 'leave_held', reasonCode: 'leave_change',
      note: `${ctx.leaveLabel} was approved for a period accounting has closed, so the timesheet was not changed. A CEO override is needed if pay must be adjusted.`,
    })
  }
  return summary
}

/**
 * Reverses applyLeaveToTimesheets for a cancelled leave request: each affected day loses the leave hours that came from
 * this leave type (salaried days go back to full Regular hours; a "Sick Leave"/"Vacation" description goes back to
 * "Regular Hours"). Same locking rules as posting: drafts are edited, submitted/approved timesheets in an open period are
 * reopened for re-review, and periods accounting has closed are left untouched (callers refuse the cancel up front).
 */
export async function removeLeaveFromTimesheets(
  admin: AdminClient,
  employeeId: string,
  leaveType: LeaveType,
  allocations: { date: string; hours: number }[],
  ctx: { actorId: string | null; leaveLabel: string } = { actorId: null, leaveLabel: leaveType },
): Promise<LeavePostingSummary> {
  const summary: LeavePostingSummary = { reopened: [], held: [] }
  if (allocations.length === 0) return summary
  const isSalaried = await isSalariedEmployee(admin, employeeId)
  const closedRanges = await loadClosedRanges(admin)
  const reopenIds = new Set<string>()
  const heldIds = new Set<string>()

  for (const { date } of allocations) {
    const period = getCurrentPeriod(undefined, new Date(`${date}T00:00:00Z`))
    const { timesheet, rows } = await getOrCreateTimesheetForEmployee(admin, employeeId, period.start, period.end)
    const row = rows.find(r => r.work_date === date)
    // Only undo leave of this type — a day since changed to something else is not ours to clear.
    if (!row || row.leave_type !== leaveType || Number(row.leave_hours) === 0) continue

    if (timesheet.status !== 'draft') {
      if (periodLockReason(period, closedRanges)) {
        if (!heldIds.has(timesheet.id)) {
          heldIds.add(timesheet.id)
          summary.held.push({ timesheetId: timesheet.id, periodStart: period.start, periodEnd: period.end })
        }
        continue
      }
      if (!reopenIds.has(timesheet.id)) {
        reopenIds.add(timesheet.id)
        summary.reopened.push({ timesheetId: timesheet.id, periodStart: period.start, periodEnd: period.end, wasApproved: timesheet.status === 'approved' })
      }
    }

    const regular_hours = isSalaried ? SALARIED_DAILY_HOURS - Number(row.holiday_hours ?? 0) : row.regular_hours
    const description = row.description === leaveDescription(leaveType) ? REGULAR_DESCRIPTION : row.description
    const { error } = await admin
      .from('timesheet_rows')
      .update({ leave_hours: 0, leave_type: null, regular_hours, description })
      .eq('id', row.id)
    if (error) throw new Error(error.message)
  }

  const note = `${ctx.leaveLabel} was cancelled and removed from this pay period. Review your entries and resubmit.`
  for (const r of summary.reopened) {
    const { error } = await admin
      .from('timesheets')
      .update({ status: 'draft', approver_id: null, approved_at: null, return_reason: `Leave added or changed: ${note}`, correction_requested_at: null, correction_note: null })
      .eq('id', r.timesheetId)
    if (error) throw new Error(error.message)
    await logTimesheetEvent(admin, { timesheetId: r.timesheetId, actorId: ctx.actorId, action: 'leave_reopened', reasonCode: 'leave_change', note })
  }
  return summary
}

export type LeaveDay = { date: string; hours: number }

/**
 * The day-by-day hours of leave requests. Requests made with the day picker have rows in `leave_request_days`; older
 * requests don't, so their total is spread across the workdays in their range (the original behaviour).
 */
export async function loadRequestDays(
  admin: AdminClient,
  requests: { id: string; start_date: string; end_date: string; hours: number | string }[],
): Promise<Map<string, LeaveDay[]>> {
  const out = new Map<string, LeaveDay[]>()
  if (requests.length === 0) return out
  const { data, error } = await admin.from('leave_request_days').select('request_id, work_date, hours').in('request_id', requests.map(r => r.id)).order('work_date')
  if (error) throw new Error(error.message)
  for (const row of data ?? []) {
    const list = out.get(row.request_id) ?? []
    list.push({ date: row.work_date, hours: Number(row.hours) })
    out.set(row.request_id, list)
  }
  for (const r of requests) {
    if (!out.has(r.id)) out.set(r.id, distributeLeaveHours(r.start_date, r.end_date, Number(r.hours)))
  }
  return out
}

/**
 * Guardrail: a person can't take more than a full (8 hr) day of leave on any workday, counting every leave request that
 * is pending or approved (any type). Also refuses weekends/holidays and hours outside 0–8 for a day. Returns a
 * plain-language reason when the days would break that, else null. `excludeId` skips the request being approved so it
 * isn't compared with itself.
 */
export async function dailyLeaveOverage(
  admin: AdminClient,
  employeeId: string,
  days: LeaveDay[],
  excludeId?: string,
): Promise<string | null> {
  if (days.length === 0) return 'Add at least one day.'
  const fmt = (d: string) => `${d.slice(5, 7)}-${d.slice(8)}-${d.slice(0, 4)}`
  const perDate = new Map<string, number>()
  for (const d of days) {
    if (!(d.hours > 0)) return `${fmt(d.date)}: enter the hours for this day.`
    if (workdaysBetween(d.date, d.date).length === 0) return `${fmt(d.date)} is a weekend or holiday — leave can only be taken on workdays.`
    perDate.set(d.date, (perDate.get(d.date) ?? 0) + d.hours)
  }
  for (const [date, hrs] of perDate) {
    if (hrs > SALARIED_DAILY_HOURS + 1e-9) return `${fmt(date)}: ${hrs} hrs is more than a day can hold — a day can’t exceed ${SALARIED_DAILY_HOURS} hrs.`
  }

  const dates = [...perDate.keys()].sort()
  const { data, error } = await admin
    .from('leave_requests')
    .select('id, leave_type, status, start_date, end_date, hours')
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'approved'])
    .lte('start_date', dates[dates.length - 1])
    .gte('end_date', dates[0])
  if (error) throw new Error(error.message)

  const others = (data ?? []).filter(r => r.id !== excludeId)
  const daysByRequest = await loadRequestDays(admin, others)
  const existing = new Map<string, { hours: number; labels: string[] }>()
  for (const r of others) {
    for (const a of daysByRequest.get(r.id) ?? []) {
      const cur = existing.get(a.date) ?? { hours: 0, labels: [] }
      cur.hours += a.hours
      cur.labels.push(`${r.leave_type === 'Personal' ? 'Vacation' : r.leave_type}, ${r.status}`)
      existing.set(a.date, cur)
    }
  }
  for (const [date, hrs] of perDate) {
    const cur = existing.get(date)
    if (cur && cur.hours + hrs > SALARIED_DAILY_HOURS + 1e-9) {
      return `You already have ${cur.hours} hrs of leave on ${fmt(date)} (${cur.labels.join('; ')}). A day can’t exceed ${SALARIED_DAILY_HOURS} hrs, so this request would go over. Cancel or shorten the other request first.`
    }
  }
  return null
}
