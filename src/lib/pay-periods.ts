// Bi-weekly pay period helpers.
//
// Anchor confirmed 2026-09-22 against CHA's actual payroll cutoff: cutoff for
// the period ending 2026-09-22 is 2026-09-24 (the standing "2 days after
// period end" rule), which requires a period boundary on 2026-09-09. Any date
// 14*n days from 2026-01-14 lands on that boundary.
const PAY_PERIOD_ANCHOR = '2026-01-14'
const PERIOD_DAYS = 14

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

/** Timesheet submission cutoff for a period — 2 calendar days after it ends (confirmed policy). */
export function getTimesheetDueDate(period: PayPeriod): string {
  const end = new Date(`${period.end}T00:00:00Z`)
  return toDateOnly(addDays(end, 2))
}

/** True if `dateStr` (YYYY-MM-DD) is the start date of a pay period relative to `anchorDate`. */
export function isPeriodBoundary(dateStr: string, anchorDate: string = PAY_PERIOD_ANCHOR): boolean {
  const anchor = new Date(`${anchorDate}T00:00:00Z`)
  const date = new Date(`${dateStr}T00:00:00Z`)
  const daysSinceAnchor = Math.round((date.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24))
  return daysSinceAnchor >= 0 && daysSinceAnchor % PERIOD_DAYS === 0
}
