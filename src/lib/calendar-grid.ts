export interface CalendarCell {
  iso: string
  day: number
  thisMonth: boolean
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Builds the full 7-column calendar grid (including leading/trailing overflow days) for `month` (0-indexed). */
export function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()

  const cells: CalendarCell[] = []
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevDays - i
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    cells.push({ iso: isoDate(py, pm, d), day: d, thisMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: isoDate(year, month, d), day: d, thisMonth: true })
  }
  let trail = 1
  while (cells.length % 7 !== 0) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    cells.push({ iso: isoDate(ny, nm, trail++), day: trail - 1, thisMonth: false })
  }
  return cells
}

/** First and last ISO date shown in the grid for `month` — use to bound a data fetch. */
export function calendarGridRange(year: number, month: number): { start: string; end: string } {
  const cells = buildCalendarGrid(year, month)
  return { start: cells[0].iso, end: cells[cells.length - 1].iso }
}
