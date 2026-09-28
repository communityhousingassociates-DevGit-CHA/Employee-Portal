// Holiday work (SOP §4 "Holiday leave"): an exempt employee who works a paid holiday at CHA's request is granted flex time equal
// to HOLIDAY_WORK_MULTIPLIER × the hours worked that day; a non-exempt employee who does so is paid time-and-a-half (the same
// multiplier) for the hours worked. Hours worked are recorded per holiday row in `holiday_worked_hours`.

export const HOLIDAY_WORK_MULTIPLIER = 1.5

/**
 * Hours worked on a holiday row. Salaried rows record them in holiday_worked_hours (their Regular column is calculated);
 * an hourly row on a holiday has no paid-holiday hours, so anything entered as Regular there is holiday work.
 */
export function holidayWorkedHours(row: { regular_hours: number | string; holiday_hours?: number | string | null; holiday_worked_hours?: number | string | null }, isHoliday: boolean): number {
  if (!isHoliday) return 0
  const explicit = Number(row.holiday_worked_hours ?? 0)
  if (explicit > 0) return explicit
  return Number(row.holiday_hours ?? 0) === 0 ? Number(row.regular_hours) : 0
}

export const round2 = (n: number) => Math.round(n * 100) / 100
