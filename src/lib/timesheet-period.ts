// Pure helpers for the timesheet's pay-period view: weekend handling, due-date urgency and per-period status.
// Shared by the timesheet page, the manager's view and the server actions, and unit-tested.

export type PeriodStatus = 'none' | 'draft' | 'returned' | 'submitted' | 'approved'
export type DueKind = 'done' | 'overdue' | 'soon' | 'ok'

type HourRow = { regular_hours: number | string; leave_hours: number | string; holiday_hours?: number | string | null }

const DAY_MS = 86400000
/** A due date this many days away or fewer is flagged as "soon". */
export const DUE_SOON_DAYS = 3

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isWeekendDate(iso: string): boolean {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return dow === 0 || dow === 6
}

export function rowHours(r: HourRow): number {
  return Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0)
}

/** Whole days from `today` to `date` (negative once `date` has passed). */
export function daysUntil(date: string, today: string): number {
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS)
}

/** How a timesheet due date should read: done once submitted, otherwise by how close (or late) it is. */
export function dueUrgency(dueDate: string, today: string, submitted: boolean): { kind: DueKind; daysLeft: number } {
  const daysLeft = daysUntil(dueDate, today)
  if (submitted) return { kind: 'done', daysLeft }
  if (daysLeft < 0) return { kind: 'overdue', daysLeft }
  if (daysLeft <= DUE_SOON_DAYS) return { kind: 'soon', daysLeft }
  return { kind: 'ok', daysLeft }
}

/** Splits a period's rows into its two weeks by date (a period starts on a Sunday). Weekend rows are listed only when asked for. */
export function splitWeeks<T extends { work_date: string }>(rows: T[], periodStart: string, includeWeekends: boolean): { week1: T[]; week2: T[] } {
  const week1End = addDays(periodStart, 6)
  const listed = rows.filter(r => includeWeekends || !isWeekendDate(r.work_date))
  return { week1: listed.filter(r => r.work_date <= week1End), week2: listed.filter(r => r.work_date > week1End) }
}

/** Weekday hours count toward the 80-hour target; weekend hours are tracked separately. */
export function splitHours(rows: (HourRow & { work_date: string })[]): { weekday: number; weekend: number; total: number } {
  let weekday = 0
  let weekend = 0
  for (const r of rows) {
    if (isWeekendDate(r.work_date)) weekend += rowHours(r)
    else weekday += rowHours(r)
  }
  return { weekday, weekend, total: weekday + weekend }
}

/** Saturdays/Sundays in the period that have no row yet. */
export function missingWeekendDates(periodStart: string, periodEnd: string, existing: Iterable<string>): string[] {
  const have = new Set(existing)
  const out: string[] = []
  for (let d = periodStart; d <= periodEnd; d = addDays(d, 1)) {
    if (isWeekendDate(d) && !have.has(d)) out.push(d)
  }
  return out
}

/** Weekend rows with no hours at all — dropped when the timesheet is submitted. */
export function unusedWeekendRowIds(rows: (HourRow & { id: string; work_date: string })[]): string[] {
  return rows.filter(r => isWeekendDate(r.work_date) && rowHours(r) === 0).map(r => r.id)
}

/** A timesheet's picker status: a draft that carries a return reason is "returned"; no timesheet yet is "none". */
export function periodStatus(t: { status: string; return_reason?: string | null } | null | undefined): PeriodStatus {
  if (!t) return 'none'
  if (t.status === 'draft' && t.return_reason) return 'returned'
  return (['draft', 'submitted', 'approved'].includes(t.status) ? t.status : 'draft') as PeriodStatus
}

/** A period needs attention when its timesheet was returned, or is still unsent past its due date. */
export function needsAttention(status: PeriodStatus, dueDate: string, today: string): boolean {
  if (status === 'returned') return true
  if (status === 'submitted' || status === 'approved') return false
  return daysUntil(dueDate, today) < 0
}
