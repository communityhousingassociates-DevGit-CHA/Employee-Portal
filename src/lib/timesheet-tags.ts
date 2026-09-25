// Timesheet tags — a small, central registry so anything that wants to flag a day or a whole timesheet does it one
// way and looks the same everywhere.
//
// AUTOMATIC tags (everything here) are DERIVED from data the portal already holds, never stored: nothing to keep in
// sync, and signed timesheets (whose rows are never edited) still tag correctly. To add one, add it to TAGS and to
// tagRows() / timesheetTags(). Hand-assigned tags (grant/program, Sage codes, activity) would be a stored field merged
// into these lists — the display code wouldn't change.

import { holidayOn } from '@/lib/holidays'
import type { LeaveType, TimesheetTag } from '@/types'

export type TagKey =
  // day-level
  | 'holiday' | 'holiday_worked' | 'leave' | 'leave_pto' | 'leave_sick' | 'leave_vacation' | 'leave_bereavement' | 'leave_jury'
  | 'incomplete' | 'long_day' | 'short_day' | 'overtime'
  // timesheet-level
  | 'correction_requested' | 'reopened' | 'late_leave' | 'closed'

type TagDef = { label: string; cls: string }

export const TAGS: Record<TagKey, TagDef> = {
  holiday: { label: 'Holiday', cls: 'bg-rose-100 text-rose-600' },
  holiday_worked: { label: 'Holiday worked', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
  leave: { label: 'Leave', cls: 'bg-violet-100 text-violet-700' },
  leave_pto: { label: 'PTO', cls: 'bg-[#e0f5f8] text-[#028a9e]' },
  leave_sick: { label: 'Sick', cls: 'bg-violet-100 text-violet-700' },
  leave_vacation: { label: 'Vacation', cls: 'bg-amber-100 text-amber-700' },
  leave_bereavement: { label: 'Bereavement', cls: 'bg-slate-100 text-slate-600' },
  leave_jury: { label: 'Jury Duty', cls: 'bg-slate-100 text-slate-600' },
  incomplete: { label: 'Incomplete', cls: 'bg-amber-100 text-amber-700' },
  long_day: { label: 'Over 8 hrs', cls: 'bg-orange-100 text-orange-700' },
  short_day: { label: 'Short day', cls: 'bg-gray-100 text-gray-600' },
  overtime: { label: 'Overtime', cls: 'bg-orange-200 text-orange-800' },
  correction_requested: { label: 'Correction requested', cls: 'bg-amber-100 text-amber-700' },
  reopened: { label: 'Reopened', cls: 'bg-red-100 text-red-600' },
  late_leave: { label: 'Leave added late', cls: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Closed by accounting', cls: 'bg-red-100 text-red-600' },
}

// Thresholds. "Over 8 hrs" is informational; "Overtime" is the weekly standard (Regular hours past 40 in a calendar
// week) — only hourly staff can reach either, since salaried Regular hours are calculated as 8 minus leave/holiday.
export const LONG_DAY_HOURS = 8
export const OVERTIME_WEEKLY_HOURS = 40
const FULL_DAY_HOURS = 8

const LEAVE_TAG: Record<LeaveType, TagKey> = {
  PTO: 'leave_pto',
  Sick: 'leave_sick',
  Personal: 'leave_vacation',
  Bereavement: 'leave_bereavement',
  'Jury Duty': 'leave_jury',
}

// Colors a managed tag can use (the managed list stores just the key).
export const TAG_COLORS: Record<string, { label: string; cls: string; dot: string }> = {
  teal: { label: 'Teal', cls: 'bg-[#e0f5f8] text-[#028a9e]', dot: 'bg-[#02ACC0]' },
  blue: { label: 'Blue', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  violet: { label: 'Violet', cls: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  rose: { label: 'Rose', cls: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' },
  amber: { label: 'Amber', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  emerald: { label: 'Green', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  orange: { label: 'Orange', cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  slate: { label: 'Gray', cls: 'bg-slate-200 text-slate-700', dot: 'bg-slate-500' },
}

export function tagColor(color: string) {
  return TAG_COLORS[color] ?? TAG_COLORS.teal
}

/** A managed (hand-picked) tag as a displayable tag. `custom` marks it as removable/editable by whoever may tag. */
export function customRowTag(t: TimesheetTag): RowTag {
  return { key: `custom:${t.id}` as TagKey, label: t.name, cls: tagColor(t.color).cls, title: t.description ?? undefined, custom: true, tagId: t.id, inactive: !t.is_active }
}

export type TaggableRow = {
  work_date: string
  regular_hours: number | string
  leave_hours: number | string
  holiday_hours?: number | string | null
  leave_type?: LeaveType | null
  tag_ids?: string[] | null
}

export type RowTag = {
  key: TagKey
  label: string
  cls: string
  /** Hover text, e.g. the holiday's name. */
  title?: string
  /** Hand-picked from the managed list (vs automatic). */
  custom?: boolean
  tagId?: string
  inactive?: boolean
}

function tag(key: TagKey, title?: string): RowTag {
  return { key, ...TAGS[key], title }
}

/** Monday of the calendar week containing `iso` (YYYY-MM-DD) — the key overtime is counted against. */
function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

/**
 * Day-level tags for a whole timesheet (rows in date order). Needs the full set because Overtime depends on the
 * running total for the week. `fullTime` enables "Short day", which would be noise for part-time staff.
 */
export function tagRows(rows: TaggableRow[], ctx: { fullTime?: boolean; customTags?: TimesheetTag[] } = {}): RowTag[][] {
  const customById = new Map((ctx.customTags ?? []).map(t => [t.id, t]))
  const weekRegular = new Map<string, number>()
  return rows.map(row => {
    const tags: RowTag[] = []
    const regular = Number(row.regular_hours)
    const leave = Number(row.leave_hours)
    const holidayHours = Number(row.holiday_hours ?? 0)
    const holiday = holidayOn(row.work_date)

    if (holiday) tags.push(tag('holiday', holiday))
    if (holiday && regular > 0) tags.push(tag('holiday_worked', `Worked ${regular} hrs on ${holiday}`))

    if (leave > 0) {
      const key = row.leave_type ? LEAVE_TAG[row.leave_type] ?? 'leave' : 'leave'
      tags.push(tag(key, row.leave_type ? `${row.leave_type} leave` : undefined))
    }

    const total = regular + leave + holidayHours
    if (total === 0 && !holiday) tags.push(tag('incomplete', 'No hours entered for this day'))

    if (regular > LONG_DAY_HOURS) tags.push(tag('long_day', `${regular} regular hours in one day`))
    if (ctx.fullTime && regular > 0 && regular < FULL_DAY_HOURS && leave === 0 && holidayHours === 0) {
      tags.push(tag('short_day', `${regular} of ${FULL_DAY_HOURS} hours`))
    }

    const wk = weekKey(row.work_date)
    const before = weekRegular.get(wk) ?? 0
    const after = before + regular
    weekRegular.set(wk, after)
    if (regular > 0 && after > OVERTIME_WEEKLY_HOURS) {
      tags.push(tag('overtime', `${Math.round((after - Math.max(before, OVERTIME_WEEKLY_HOURS)) * 100) / 100} hrs past ${OVERTIME_WEEKLY_HOURS} this week`))
    }

    // Hand-picked tags from the managed list come last, after the automatic ones.
    for (const id of row.tag_ids ?? []) {
      const c = customById.get(id)
      if (c) tags.push(customRowTag(c))
    }
    return tags
  })
}

/** A timesheet's own state as tags: reopened, correction requested, leave added late, and why it's locked. */
export function timesheetTags(t: {
  status: string
  return_reason?: string | null
  correction_requested_at?: string | null
  lock_reason?: 'closed' | null
  events?: { action: string }[]
}): RowTag[] {
  const tags: RowTag[] = []
  if (t.status === 'draft' && t.return_reason) tags.push(tag('reopened', t.return_reason))
  if (t.correction_requested_at) tags.push(tag('correction_requested'))
  const lateLeave = (t.events ?? []).some(e => e.action === 'leave_reopened' || e.action === 'leave_held') ||
    (t.status === 'draft' && !!t.return_reason && t.return_reason.startsWith('Leave added or changed'))
  if (lateLeave) tags.push(tag('late_leave', 'Leave was added after this timesheet was submitted'))
  if (t.lock_reason === 'closed') tags.push(tag('closed', 'Accounting closed these dates'))
  return tags
}
