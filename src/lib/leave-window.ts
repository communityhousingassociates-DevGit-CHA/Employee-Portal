import { todayET } from '@/lib/pay-periods'

// How far back a leave request may start. Time is meant to be captured daily, but staff catching up on the
// current pay period need the recent past open. Once accounting closes out a period, no further changes
// or requests should occur for it (period close is planned; payroll lock in lib/pay-periods.ts is the current stop).
export const LEAVE_BACKDATE_DAYS = 14

/** Earliest allowed leave start date (YYYY-MM-DD, CHA local time): today minus LEAVE_BACKDATE_DAYS. */
export function earliestLeaveDate(now: Date = new Date()): string {
  const d = new Date(`${todayET(now)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - LEAVE_BACKDATE_DAYS)
  return d.toISOString().slice(0, 10)
}
