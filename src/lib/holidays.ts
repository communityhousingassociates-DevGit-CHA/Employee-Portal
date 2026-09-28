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
  // 2027 (weekend holidays shown on their observed weekday)
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King Jr. Day',
  '2027-02-15': "Presidents' Day",
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth (observed)',
  '2027-07-05': 'Independence Day (observed)',
  '2027-09-06': 'Labor Day',
  '2027-10-11': "Indigenous Peoples' Day",
  '2027-11-25': 'Thanksgiving Day',
  '2027-11-26': 'Thanksgiving Friday',
  '2027-12-24': 'Christmas Day (observed)',
  '2027-12-31': "New Year's Day (observed)",
}

export function holidayOn(iso: string): string | null {
  return HOLIDAYS[iso] ?? null
}
