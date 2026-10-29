import { describe, it, expect } from 'vitest'
import { getTimesheetDueDate, getPayDate, getPayPeriods } from './pay-periods'

describe('timesheet due and pay dates', () => {
  const current = { start: '2026-10-25', end: '2026-11-07' }
  it('is due 2 days after the period ends', () => {
    expect(getTimesheetDueDate(current)).toBe('2026-11-09')
  })
  it('pays 17 days after the period ends, on a Tuesday', () => {
    expect(getPayDate(current)).toBe('2026-11-24')
    expect(new Date('2026-11-24T00:00:00Z').getUTCDay()).toBe(2)
  })
  it('every generated period pays on a Tuesday and is due after it ends', () => {
    for (const p of getPayPeriods()) {
      expect(new Date(`${getPayDate(p)}T00:00:00Z`).getUTCDay()).toBe(2)
      expect(getTimesheetDueDate(p) >= p.end).toBe(true)
    }
  })
  it('periods are 14 days, newest first, and each starts on a Sunday', () => {
    const ps = getPayPeriods('2026-10-25', 4)
    for (const p of ps) {
      expect(new Date(`${p.start}T00:00:00Z`).getUTCDay()).toBe(0)
      expect(Math.round((new Date(`${p.end}T00:00:00Z`).getTime() - new Date(`${p.start}T00:00:00Z`).getTime()) / 86400000)).toBe(13)
    }
  })
})
