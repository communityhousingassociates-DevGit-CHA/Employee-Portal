// What a salaried employee's timesheet day carries automatically. Policy (2026-10-01): REGULAR hours are only populated up to
// the current date (Eastern Time) — a day that hasn't arrived yet starts empty, and is filled in when its date comes. Two things
// are real, scheduled facts rather than a guess about hours worked, so they show right away on a future day: scheduled
// HOLIDAYS (holiday hours) and APPROVED LEAVE. Pure; shared by the server and the form.

export const SALARIED_DAILY_HOURS = 8

export function salariedDayHours(opts: { date: string; today: string; scheduledHoliday: boolean; leaveHours: number }): { regular: number; holiday: number; leave: number } {
  const holiday = opts.scheduledHoliday ? SALARIED_DAILY_HOURS : 0
  const leave = Math.min(Math.max(0, Math.min(SALARIED_DAILY_HOURS, Number(opts.leaveHours) || 0)), SALARIED_DAILY_HOURS - holiday)
  if (opts.date > opts.today) return { regular: 0, holiday, leave }
  return { regular: SALARIED_DAILY_HOURS - leave - holiday, holiday, leave }
}
