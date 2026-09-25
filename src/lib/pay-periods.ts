// Bi-weekly pay period helpers.
//
// Schedule confirmed 2026-09-25 from CHA's payroll calendar: bi-weekly SUNDAY–SATURDAY periods (9/13–9/26/2026,
// 9/27–10/10, …), paid by direct deposit on the Tuesday 17 days after each period ends. Any date 14*n days from the
// anchor is a period start, so the same cycle carries straight through 2027 and beyond.
const PAY_PERIOD_ANCHOR = '2026-09-13'
const PERIOD_DAYS = 14

// Pay date = 17 days after period end (verified against all seven CHA rows through 1/5/2027). Dates after
// CONFIRMED_PAY_DATES_THROUGH are projected from the same cycle and may shift for bank holidays.
export const PAY_DATE_DAYS_AFTER_PERIOD_END = 17
export const CONFIRMED_PAY_DATES_THROUGH = '2027-01-05'

export interface PayPeriod {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD (inclusive, 13 days after start)
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

/** Generates `count` consecutive bi-weekly periods starting at `anchorDate`. */
export function getPayPeriods(anchorDate: string = PAY_PERIOD_ANCHOR, count = 26): PayPeriod[] {
  const anchor = new Date(`${anchorDate}T00:00:00Z`)
  const periods: PayPeriod[] = []
  for (let i = 0; i < count; i++) {
    const start = addDays(anchor, i * PERIOD_DAYS)
    const end = addDays(start, PERIOD_DAYS - 1)
    periods.push({ start: toDateOnly(start), end: toDateOnly(end) })
  }
  return periods
}

/** Returns the pay period containing `asOf` (defaults to now), relative to `anchorDate`. */
export function getCurrentPeriod(anchorDate: string = PAY_PERIOD_ANCHOR, asOf: Date = new Date()): PayPeriod {
  const anchor = new Date(`${anchorDate}T00:00:00Z`)
  const msSinceAnchor = asOf.getTime() - anchor.getTime()
  const daysSinceAnchor = Math.floor(msSinceAnchor / (1000 * 60 * 60 * 24))
  const periodIndex = Math.floor(daysSinceAnchor / PERIOD_DAYS)
  const start = addDays(anchor, periodIndex * PERIOD_DAYS)
  const end = addDays(start, PERIOD_DAYS - 1)
  return { start: toDateOnly(start), end: toDateOnly(end) }
}

/** Returns the `count` most recent pay periods up to and including the current one, most recent first. */
export function getRecentPeriods(count = 6, anchorDate: string = PAY_PERIOD_ANCHOR, asOf: Date = new Date()): PayPeriod[] {
  const current = getCurrentPeriod(anchorDate, asOf)
  const currentStart = new Date(`${current.start}T00:00:00Z`)
  const periods: PayPeriod[] = []
  for (let i = 0; i < count; i++) {
    const start = addDays(currentStart, -i * PERIOD_DAYS)
    const end = addDays(start, PERIOD_DAYS - 1)
    periods.push({ start: toDateOnly(start), end: toDateOnly(end) })
  }
  return periods
}

/**
 * Returns every pay period from the one containing `sinceDate` through the
 * current one, most recent first — for period pickers that need to go back
 * further than a fixed recent window (e.g. an employee's full tenure).
 * Capped at 130 periods (~5 years) as a sanity bound, not a real limit.
 */
export function getPeriodsSince(sinceDate: string, anchorDate: string = PAY_PERIOD_ANCHOR, asOf: Date = new Date()): PayPeriod[] {
  const current = getCurrentPeriod(anchorDate, asOf)
  const currentStart = new Date(`${current.start}T00:00:00Z`)
  const since = new Date(`${sinceDate}T00:00:00Z`)
  const count = Math.min(Math.max(Math.floor((currentStart.getTime() - since.getTime()) / (PERIOD_DAYS * 86400000)) + 1, 1), 130)
  return getRecentPeriods(count, anchorDate, asOf)
}

/** Returns the pay period immediately before the one containing `asOf`. */
export function getPreviousPeriod(anchorDate: string = PAY_PERIOD_ANCHOR, asOf: Date = new Date()): PayPeriod {
  const current = getCurrentPeriod(anchorDate, asOf)
  const currentStart = new Date(`${current.start}T00:00:00Z`)
  const start = addDays(currentStart, -PERIOD_DAYS)
  const end = addDays(start, PERIOD_DAYS - 1)
  return { start: toDateOnly(start), end: toDateOnly(end) }
}

// One-time extensions to a period's timesheet due date, keyed by the period's start date. Go-live: staff are still
// entering the leave they took since the balances were loaded as of 2026-09-13, so the first period (9/13–9/26,
// normally due Monday 9/28) is due Friday 10/2 instead.
const TIMESHEET_DUE_OVERRIDES: Record<string, string> = {
  '2026-09-13': '2026-10-02',
}

/** Timesheet submission cutoff for a period — 2 calendar days after it ends (confirmed policy), unless extended above. */
export function getTimesheetDueDate(period: PayPeriod): string {
  const extended = TIMESHEET_DUE_OVERRIDES[period.start]
  if (extended) return extended
  const end = new Date(`${period.end}T00:00:00Z`)
  return toDateOnly(addDays(end, 2))
}

/** Direct-deposit pay date for a period (YYYY-MM-DD): the Tuesday 17 days after it ends. */
export function getPayDate(period: { end: string }): string {
  const end = new Date(`${period.end}T00:00:00Z`)
  return toDateOnly(addDays(end, PAY_DATE_DAYS_AFTER_PERIOD_END))
}

export interface PayCalendarEntry extends PayPeriod {
  timesheetDue: string
  payDate: string
  /** True if the pay date is on CHA's published schedule; false if projected from the same cycle. */
  confirmed: boolean
}

/** The current pay period and the next `count - 1`, each with its timesheet-due and pay dates. */
export function getPayCalendar(count = 6, asOf: Date = new Date()): PayCalendarEntry[] {
  const current = getCurrentPeriod(PAY_PERIOD_ANCHOR, asOf)
  return getPayPeriods(current.start, count).map(p => {
    const payDate = getPayDate(p)
    return { ...p, timesheetDue: getTimesheetDueDate(p), payDate, confirmed: payDate <= CONFIRMED_PAY_DATES_THROUGH }
  })
}

/** Today's date in CHA's timezone (America/New_York), as YYYY-MM-DD. */
export function todayET(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}


/** A range of dates accounting has closed out (inclusive). */
export interface ClosedRange {
  start: string
  end: string
}

/** The first closed range containing `date`, or null. */
export function closedRangeOn(date: string, ranges: ClosedRange[]): ClosedRange | null {
  return ranges.find(r => date >= r.start && date <= r.end) ?? null
}

/** The first closed range overlapping [start, end], or null. */
export function closedRangeOverlapping(start: string, end: string, ranges: ClosedRange[]): ClosedRange | null {
  return ranges.find(r => start <= r.end && end >= r.start) ?? null
}

/**
 * Whether a pay period is locked: 'closed' if accounting has closed any date inside it (Close Period), otherwise null.
 * Closing is the only lock — reopening a locked period's timesheet takes the CEO override.
 */
export function periodLockReason(period: { start: string; end: string }, ranges: ClosedRange[]): 'closed' | null {
  return closedRangeOverlapping(period.start, period.end, ranges) ? 'closed' : null
}

/** True if `dateStr` (YYYY-MM-DD) is the start date of a pay period relative to `anchorDate`. */
export function isPeriodBoundary(dateStr: string, anchorDate: string = PAY_PERIOD_ANCHOR): boolean {
  const anchor = new Date(`${anchorDate}T00:00:00Z`)
  const date = new Date(`${dateStr}T00:00:00Z`)
  const daysSinceAnchor = Math.round((date.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24))
  return daysSinceAnchor >= 0 && daysSinceAnchor % PERIOD_DAYS === 0
}
