// CHA's house date format is numeric month-day-year (e.g. 09-22-2026) — plain
// digits, no spelled-out month/weekday, for easier scanning and search/filter
// matching against how CHA's own records are formatted. Use these everywhere
// a date is displayed as text — native <input type="date"> pickers are
// unaffected (the browser controls their display; the underlying value stays
// ISO yyyy-mm-dd either way). The Dashboard's prose greeting is a deliberate
// exception — it stays spelled out ("Tuesday, September 22, 2026").

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Parses a date-only string ('YYYY-MM-DD') as local time, not UTC — avoids the
 *  classic off-by-one where `new Date('2026-09-22')` parsed as UTC midnight
 *  reads back as the 21st in a negative-UTC-offset timezone. Full timestamps
 *  (with a time component) pass through untouched. */
function toLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value
  return new Date(value.length <= 10 ? `${value}T00:00:00` : value)
}

/** "09-22-2026" */
export function fmtDate(value: string | Date): string {
  const d = toLocalDate(value)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`
}

/** "09-22" — no year, for ranges and pickers where the year is already clear from context. */
export function fmtDateShort(value: string | Date): string {
  const d = toLocalDate(value)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "09-22-2026, 3:45 PM" — date plus time, for timestamps. */
export function fmtDateTime(value: string | Date): string {
  const d = toLocalDate(value)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${fmtDate(d)}, ${time}`
}

/** "09-22-2026 – 10-05-2026" */
export function fmtDateRange(start: string | Date, end: string | Date): string {
  return `${fmtDate(start)} – ${fmtDate(end)}`
}
