import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { applyDayDefaults } from './leave-timesheet'
import { salariedDayHours } from './timesheet-defaults'
import type { TimesheetRow } from '@/types'

describe('salariedDayHours', () => {
  it('fills 8 regular hours up to today, nothing after', () => {
    expect(salariedDayHours({ date: '2026-10-29', today: '2026-10-30', scheduledHoliday: false, leaveHours: 0 })).toEqual({ regular: 8, holiday: 0, leave: 0 })
    expect(salariedDayHours({ date: '2026-10-31', today: '2026-10-30', scheduledHoliday: false, leaveHours: 0 }).regular).toBe(0)
  })
  it('takes leave out of the 8-hour day', () => {
    expect(salariedDayHours({ date: '2026-10-28', today: '2026-10-30', scheduledHoliday: false, leaveHours: 3 })).toEqual({ regular: 5, holiday: 0, leave: 3 })
  })
  it('shows a scheduled holiday straight away, even in the future', () => {
    expect(salariedDayHours({ date: '2026-11-26', today: '2026-10-30', scheduledHoliday: true, leaveHours: 0 })).toEqual({ regular: 0, holiday: 8, leave: 0 })
  })
})

// A tiny stand-in for the Supabase admin client: a salaried employee with no year-end holiday choice, recording row updates.
function fakeAdmin() {
  const updates: { id: string; patch: Record<string, unknown> }[] = []
  const admin = {
    from(table: string) {
      if (table === 'employees') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { year_end_holiday: null } }) }) }) }
      if (table === 'employee_current_salary') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { employee_id: 'e1' }, error: null }) }) }) }
      if (table === 'timesheet_rows') return { update: (patch: Record<string, unknown>) => ({ eq: async (_col: string, id: string) => { updates.push({ id, patch }); return { error: null } } }) }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return { admin: admin as unknown as Parameters<typeof applyDayDefaults>[0], updates }
}

const mk = (id: string, work_date: string, regular: number, description: string | null = 'Regular Hours'): TimesheetRow =>
  ({ id, work_date, description, regular_hours: regular, leave_hours: 0, holiday_hours: 0 } as unknown as TimesheetRow)

describe('applyDayDefaults and weekend rows', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T15:00:00Z')) }) // Tue Nov 3, ET
  afterEach(() => vi.useRealTimers())

  it('fills a past weekday for a salaried employee', async () => {
    const { admin, updates } = fakeAdmin()
    const out = await applyDayDefaults(admin, 'e1', [mk('mon', '2026-10-26', 0)])
    expect(out[0].regular_hours).toBe(8)
    expect(updates).toEqual([{ id: 'mon', patch: { regular_hours: 8 } }])
  })

  it('never auto-fills a weekend row — the hours typed in stay as they are', async () => {
    const { admin, updates } = fakeAdmin()
    const out = await applyDayDefaults(admin, 'e1', [mk('sat', '2026-10-31', 4, 'Weekend Hours'), mk('sun', '2026-11-01', 0, 'Weekend Hours')])
    expect(out.map(r => Number(r.regular_hours))).toEqual([4, 0])
    expect(updates).toEqual([])
  })

  it('leaves weekend rows alone even when weekday rows around them change', async () => {
    const { admin, updates } = fakeAdmin()
    await applyDayDefaults(admin, 'e1', [mk('fri', '2026-10-30', 0), mk('sat', '2026-10-31', 6, 'Weekend Hours')])
    expect(updates.map(u => u.id)).toEqual(['fri'])
  })
})
