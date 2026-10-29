import { describe, it, expect } from 'vitest'
import {
  addDays, isWeekendDate, rowHours, daysUntil, dueUrgency, splitWeeks, splitHours,
  missingWeekendDates, unusedWeekendRowIds, periodStatus, needsAttention, DUE_SOON_DAYS,
} from './timesheet-period'

// The current pay period in the portal: Sun Oct 25 – Sat Nov 7, 2026 (due Mon Nov 9).
const START = '2026-10-25'
const END = '2026-11-07'

const row = (work_date: string, regular = 0, leave = 0, holiday = 0, id = work_date) => ({ id, work_date, regular_hours: regular, leave_hours: leave, holiday_hours: holiday })

describe('dates', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays(START, 13)).toBe(END)
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('spots weekend dates', () => {
    expect(isWeekendDate('2026-10-25')).toBe(true) // Sunday
    expect(isWeekendDate('2026-10-26')).toBe(false) // Monday
    expect(isWeekendDate('2026-10-31')).toBe(true) // Saturday
  })
  it('counts days until a date, signed', () => {
    expect(daysUntil('2026-11-09', '2026-10-30')).toBe(10)
    expect(daysUntil('2026-11-09', '2026-11-09')).toBe(0)
    expect(daysUntil('2026-11-09', '2026-11-12')).toBe(-3)
  })
  it('is not thrown off by a daylight-saving change', () => {
    expect(daysUntil('2026-11-02', '2026-10-31')).toBe(2) // clocks go back on Nov 1
  })
})

describe('dueUrgency', () => {
  it('is done once submitted, however late', () => {
    expect(dueUrgency('2026-11-09', '2026-11-20', true).kind).toBe('done')
  })
  it('is ok with more than the soon window left', () => {
    expect(dueUrgency('2026-11-09', '2026-10-30', false)).toEqual({ kind: 'ok', daysLeft: 10 })
    expect(dueUrgency('2026-11-09', '2026-11-05', false).kind).toBe('ok') // 4 days
  })
  it(`is soon within ${DUE_SOON_DAYS} days, including today`, () => {
    expect(dueUrgency('2026-11-09', '2026-11-06', false).kind).toBe('soon')
    expect(dueUrgency('2026-11-09', '2026-11-09', false)).toEqual({ kind: 'soon', daysLeft: 0 })
  })
  it('is overdue after the due date', () => {
    expect(dueUrgency('2026-11-09', '2026-11-10', false)).toEqual({ kind: 'overdue', daysLeft: -1 })
  })
})

describe('splitWeeks', () => {
  const rows = [
    row('2026-10-25'), row('2026-10-26'), row('2026-10-27'), row('2026-10-30'), row('2026-10-31'),
    row('2026-11-01'), row('2026-11-02'), row('2026-11-06'), row('2026-11-07'),
  ]
  it('hides weekend rows by default and splits by date', () => {
    const { week1, week2 } = splitWeeks(rows, START, false)
    expect(week1.map(r => r.work_date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-30'])
    expect(week2.map(r => r.work_date)).toEqual(['2026-11-02', '2026-11-06'])
  })
  it('puts weekend rows in the right week when shown', () => {
    const { week1, week2 } = splitWeeks(rows, START, true)
    expect(week1.map(r => r.work_date)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-30', '2026-10-31'])
    expect(week2.map(r => r.work_date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-06', '2026-11-07'])
  })
  it('does not depend on how many rows each week has', () => {
    const { week1, week2 } = splitWeeks([row('2026-11-02'), row('2026-11-03')], START, false)
    expect(week1).toEqual([])
    expect(week2).toHaveLength(2)
  })
})

describe('hours', () => {
  it('sums regular + leave + holiday for a row', () => {
    expect(rowHours(row('2026-10-26', 5, 3))).toBe(8)
    expect(rowHours({ regular_hours: '4', leave_hours: '0', holiday_hours: null })).toBe(4)
  })
  it('keeps weekend hours out of the weekday total', () => {
    const rows = [row('2026-10-26', 8), row('2026-10-27', 4, 4), row('2026-10-28', 0, 0, 8), row('2026-10-31', 5), row('2026-11-01', 2)]
    expect(splitHours(rows)).toEqual({ weekday: 24, weekend: 7, total: 31 })
  })
  it('is all zero for no rows', () => {
    expect(splitHours([])).toEqual({ weekday: 0, weekend: 0, total: 0 })
  })
})

describe('weekend rows', () => {
  it('finds the weekend days that have no row yet', () => {
    expect(missingWeekendDates(START, END, [])).toEqual(['2026-10-25', '2026-10-31', '2026-11-01', '2026-11-07'])
  })
  it('skips weekend days that already have a row', () => {
    expect(missingWeekendDates(START, END, ['2026-10-31', '2026-11-01', '2026-10-26'])).toEqual(['2026-10-25', '2026-11-07'])
  })
  it('finds nothing missing when all four exist', () => {
    expect(missingWeekendDates(START, END, ['2026-10-25', '2026-10-31', '2026-11-01', '2026-11-07'])).toEqual([])
  })
  it('only flags weekend rows with no hours as unused', () => {
    const rows = [row('2026-10-25', 0, 0, 0, 'a'), row('2026-10-31', 3, 0, 0, 'b'), row('2026-11-07', 0, 0, 0, 'c'), row('2026-10-26', 0, 0, 0, 'weekday-empty')]
    expect(unusedWeekendRowIds(rows)).toEqual(['a', 'c'])
  })
})

describe('periodStatus', () => {
  it('is none when there is no timesheet', () => {
    expect(periodStatus(null)).toBe('none')
    expect(periodStatus(undefined)).toBe('none')
  })
  it('passes through draft, submitted and approved', () => {
    expect(periodStatus({ status: 'draft' })).toBe('draft')
    expect(periodStatus({ status: 'submitted' })).toBe('submitted')
    expect(periodStatus({ status: 'approved' })).toBe('approved')
  })
  it('treats a draft with a return reason as returned', () => {
    expect(periodStatus({ status: 'draft', return_reason: 'Add descriptions' })).toBe('returned')
    expect(periodStatus({ status: 'draft', return_reason: null })).toBe('draft')
  })
  it('does not call a submitted sheet returned just because the old reason lingers', () => {
    expect(periodStatus({ status: 'submitted', return_reason: 'old' })).toBe('submitted')
  })
})

describe('needsAttention', () => {
  it('flags returned periods', () => {
    expect(needsAttention('returned', '2026-11-09', '2026-10-30')).toBe(true)
  })
  it('flags unsent periods past their due date', () => {
    expect(needsAttention('draft', '2026-11-09', '2026-11-10')).toBe(true)
    expect(needsAttention('none', '2026-11-09', '2026-11-10')).toBe(true)
  })
  it('does not flag unsent periods that are still on time', () => {
    expect(needsAttention('draft', '2026-11-09', '2026-11-09')).toBe(false)
  })
  it('never flags submitted or approved periods', () => {
    expect(needsAttention('submitted', '2026-11-09', '2026-12-01')).toBe(false)
    expect(needsAttention('approved', '2026-11-09', '2026-12-01')).toBe(false)
  })
})
