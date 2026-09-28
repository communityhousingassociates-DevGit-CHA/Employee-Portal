// CHA's paid holidays (SOP §4 "Holiday leave"), observed dates — a real `holidays` table is explicitly deferred.
// Not listed: the Christmas Eve / New Year's Eve day each employee chooses (needs a per-employee setting, not built yet).
export const HOLIDAYS: Record<string, string> = {
  // 2026
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Presidents' Day",
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-04': 'Independence Day',
  '2026-09-07': 'Labor Day',
  '2026-10-12': "Indigenous Peoples' Day",
  '2026-11-26': 'Thanksgiving Day',
  '2026-11-27': 'Thanksgiving Friday',
  '2026-12-25': 'Christmas Day',
  // 2027. Holidays that fall on a weekend (Juneteenth Sat 6/19, July 4 Sun, Christmas Sat 12/25, New Year's Day Sat 1/1/2028) are NOT moved
  // to a Friday/Monday: CHA's SOP doesn't say it observes them, so this is unconfirmed — ask CHA, then add the observed dates here if it does.
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King Jr. Day',
  '2027-02-15': "Presidents' Day",
  '2027-05-31': 'Memorial Day',
  '2027-09-06': 'Labor Day',
  '2027-10-11': "Indigenous Peoples' Day",
  '2027-11-25': 'Thanksgiving Day',
  '2027-11-26': 'Thanksgiving Friday',
}

// Each employee picks Christmas Eve OR New Year's Eve as their paid holiday (employees.year_end_holiday): December 24 or December 31.
export type YearEndChoice = 'christmas_eve' | 'new_years_eve'
const YEAR_END_DATES: Record<string, Record<YearEndChoice, string>> = {
  '2026': { christmas_eve: '2026-12-24', new_years_eve: '2026-12-31' },
  '2027': { christmas_eve: '2027-12-24', new_years_eve: '2027-12-31' },
}

export function yearEndDate(year: number | string, choice: YearEndChoice): string | null {
  return YEAR_END_DATES[String(year)]?.[choice] ?? null
}

/** The holiday on `iso`, if any. Pass the employee's year-end choice to include their Christmas Eve / New Year's Eve day. */
export function holidayOn(iso: string, yearEnd?: YearEndChoice | null): string | null {
  const shared = HOLIDAYS[iso]
  if (shared) return shared
  if (yearEnd && yearEndDate(iso.slice(0, 4), yearEnd) === iso) return yearEnd === 'christmas_eve' ? 'Christmas Eve' : "New Year's Eve"
  return null
}
