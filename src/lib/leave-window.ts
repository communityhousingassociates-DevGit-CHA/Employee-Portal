import { todayET } from '@/lib/pay-periods'

// How far back a leave request may start. Time is meant to be captured daily, but staff catching up on the
// current pay period need the recent past open. Once accounting closes out a period, no further changes
// or requests should occur for it (Close Period; the payroll lock in lib/pay-periods.ts is the other stop).
export const LEAVE_BACKDATE_DAYS = 14

// One-time catch-up for go-live: balances were loaded as of 2026-09-13 and staff enter leave for the pay period
// starting then, so until payroll for that period is due the window reaches all the way back to it — even when
// that is more than LEAVE_BACKDATE_DAYS ago. After `through` the normal rolling window applies.
export const LEAVE_CATCHUP = { from: '2026-09-13', through: '2026-10-08' }

/** Earliest allowed leave start date (YYYY-MM-DD, CHA local time). */
export function earliestLeaveDate(now: Date = new Date()): string {
  const today = todayET(now)
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - LEAVE_BACKDATE_DAYS)
  const rolling = d.toISOString().slice(0, 10)
  if (today <= LEAVE_CATCHUP.through && LEAVE_CATCHUP.from < rolling) return LEAVE_CATCHUP.from
  return rolling
}
