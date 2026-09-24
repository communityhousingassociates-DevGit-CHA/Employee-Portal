// Timesheet row tags — a small, central registry so anything that wants to flag a day (holiday, leave type,
// incomplete, and later things like training or travel) does it one way and looks the same everywhere.
//
// Tags are DERIVED from the row's own data, not stored: nothing to keep in sync, and signed timesheets (whose
// rows are never edited) still tag correctly. To add a tag, add it to TAGS and to rowTags(). If tags ever need to
// be assigned by hand, add a stored `tags` column and merge it into rowTags() — the display code won't change.

import { holidayOn } from '@/lib/holidays'
import type { LeaveType } from '@/types'

export type TagKey = 'holiday' | 'leave_pto' | 'leave_sick' | 'leave_vacation' | 'leave_bereavement' | 'leave_jury' | 'leave' | 'incomplete'

type TagDef = { label: string; cls: string }

export const TAGS: Record<TagKey, TagDef> = {
  holiday: { label: 'Holiday', cls: 'bg-rose-100 text-rose-600' },
  leave_pto: { label: 'PTO', cls: 'bg-[#e0f5f8] text-[#028a9e]' },
  leave_sick: { label: 'Sick', cls: 'bg-violet-100 text-violet-700' },
  leave_vacation: { label: 'Vacation', cls: 'bg-amber-100 text-amber-700' },
  leave_bereavement: { label: 'Bereavement', cls: 'bg-slate-100 text-slate-600' },
  leave_jury: { label: 'Jury Duty', cls: 'bg-slate-100 text-slate-600' },
  leave: { label: 'Leave', cls: 'bg-violet-100 text-violet-700' },
  incomplete: { label: 'Incomplete', cls: 'bg-amber-100 text-amber-700' },
}

const LEAVE_TAG: Record<LeaveType, TagKey> = {
  PTO: 'leave_pto',
  Sick: 'leave_sick',
  Personal: 'leave_vacation',
  Bereavement: 'leave_bereavement',
  'Jury Duty': 'leave_jury',
}

export type TaggableRow = {
  work_date: string
  regular_hours: number | string
  leave_hours: number | string
  holiday_hours?: number | string | null
  leave_type?: LeaveType | null
}

export type RowTag = { key: TagKey; label: string; cls: string; /** Hover text, e.g. the holiday's name. */ title?: string }

export function rowTags(row: TaggableRow): RowTag[] {
  const tags: RowTag[] = []
  const holiday = holidayOn(row.work_date)
  if (holiday) tags.push({ key: 'holiday', ...TAGS.holiday, title: holiday })

  if (Number(row.leave_hours) > 0) {
    const key = row.leave_type ? LEAVE_TAG[row.leave_type] ?? 'leave' : 'leave'
    tags.push({ key, ...TAGS[key], title: row.leave_type ? `${row.leave_type} leave` : undefined })
  }

  const total = Number(row.regular_hours) + Number(row.leave_hours) + Number(row.holiday_hours ?? 0)
  if (total === 0 && !holiday) tags.push({ key: 'incomplete', ...TAGS.incomplete, title: 'No hours entered for this day' })
  return tags
}
