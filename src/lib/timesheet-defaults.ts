// What a salaried employee's timesheet day carries automatically. Policy (2026-10-01): hours are only populated up to the
// current date (Eastern Time) — a day that hasn't arrived yet starts empty, and is filled in when its date comes. Approved
// leave is the exception: it is a real, scheduled entry, so it stays on a future day. Pure; shared by the server and the form.

export const SALARIED_DAILY_HOURS = 8

export function salariedDayHours(opts: { date: string; today: string; scheduledHoliday: boolean; leaveHours: number }): { regular: number; holiday: number; leave: number } {
  const leave = Math.max(0, Math.min(SALARIED_DAILY_HOURS, Number(opts.leaveHours) || 0))
  if (opts.date > opts.today) return { regular: 0, holiday: 0, leave }
  const holiday = opts.scheduledHoliday ? SALARIED_DAILY_HOURS : 0
  const leaveCapped = Math.min(leave, SALARIED_DAILY_HOURS - holiday)
  return { regular: SALARIED_DAILY_HOURS - leaveCapped - holiday, holiday, leave: leaveCapped }
}
