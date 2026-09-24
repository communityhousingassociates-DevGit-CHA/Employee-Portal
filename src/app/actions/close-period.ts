'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
import { CLOSE_PERIOD_ROLES } from '@/lib/constants/approvals'
import { REOPEN_OVERRIDE_ROLES } from '@/lib/constants/timesheet-reopen'
import { loadClosedRanges } from '@/lib/period-lock'
import { todayET, type ClosedRange } from '@/lib/pay-periods'
import { fmtDate, fmtDateRange } from '@/lib/format-date'

const MAX_SPAN_DAYS = 92

function validateRange(start: string, end: string) {
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (!iso.test(start) || !iso.test(end)) throw new Error('Choose a start and end date')
  if (end < start) throw new Error('The end date can’t be before the start date')
  if (end > todayET()) throw new Error('You can only close dates up to today')
  const span = (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000 + 1
  if (span > MAX_SPAN_DAYS) throw new Error(`Close at most ${MAX_SPAN_DAYS} days at a time`)
}

/** Active closed ranges — dates only, so any signed-in employee can read them (timesheet and leave forms need to know). */
export async function getActiveClosedRanges(): Promise<ClosedRange[]> {
  const employee = await getCurrentEmployee()
  if (!employee) return []
  return loadClosedRanges(createAdminClient())
}

/** Full closure history (active and lifted), newest first. */
export async function getClosedPeriods() {
  await requireRole(CLOSE_PERIOD_ROLES)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('closed_periods')
    .select('*, closer:employees!closed_periods_closed_by_fkey(name), lifter:employees!closed_periods_lifted_by_fkey(name)')
    .order('closed_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  const nameOf = (v: unknown) => (Array.isArray(v) ? v[0]?.name : (v as { name?: string } | null)?.name) ?? null
  return (data ?? []).map(r => ({
    id: r.id as string,
    start_date: r.start_date as string,
    end_date: r.end_date as string,
    note: (r.note as string | null) ?? null,
    closed_at: r.closed_at as string,
    closed_by_name: nameOf(r.closer),
    lifted_at: (r.lifted_at as string | null) ?? null,
    lifted_by_name: nameOf(r.lifter),
    lift_note: (r.lift_note as string | null) ?? null,
  }))
}

export type ClosePreview = {
  drafts: { name: string; period: string }[]
  submitted: { name: string; period: string }[]
  approved: number
  pendingLeave: { name: string; label: string }[]
}

/** What closing these dates would freeze — so accounting sees unfinished business before confirming. */
export async function previewClosePeriod(start: string, end: string): Promise<ClosePreview> {
  await requireRole(CLOSE_PERIOD_ROLES)
  validateRange(start, end)
  const admin = createAdminClient()

  const [{ data: sheets, error: sheetError }, { data: leave, error: leaveError }] = await Promise.all([
    admin.from('timesheets').select('status, period_start, period_end, employee:employees!timesheets_employee_id_fkey(name)').lte('period_start', end).gte('period_end', start),
    admin.from('leave_requests').select('leave_type, start_date, end_date, employee:employees!leave_requests_employee_id_fkey(name)').eq('status', 'pending').lte('start_date', end).gte('end_date', start),
  ])
  if (sheetError) throw new Error(sheetError.message)
  if (leaveError) throw new Error(leaveError.message)

  const nameOf = (v: unknown) => (Array.isArray(v) ? v[0]?.name : (v as { name?: string } | null)?.name) ?? 'Unknown'
  const preview: ClosePreview = { drafts: [], submitted: [], approved: 0, pendingLeave: [] }
  for (const t of sheets ?? []) {
    const entry = { name: nameOf(t.employee), period: fmtDateRange(t.period_start, t.period_end) }
    if (t.status === 'draft') preview.drafts.push(entry)
    else if (t.status === 'submitted') preview.submitted.push(entry)
    else preview.approved++
  }
  for (const l of leave ?? []) {
    preview.pendingLeave.push({ name: nameOf(l.employee), label: `${l.leave_type}, ${l.start_date === l.end_date ? fmtDate(l.start_date) : `${fmtDate(l.start_date)} – ${fmtDate(l.end_date)}`}` })
  }
  return preview
}

/** Closes a range of dates: no new leave for them, timesheets touching them lock, reopening needs the CEO override. */
export async function closePeriod(start: string, end: string, note: string) {
  const actor = await requireRole(CLOSE_PERIOD_ROLES)
  validateRange(start, end)
  const admin = createAdminClient()
  const { error } = await admin.from('closed_periods').insert({ start_date: start, end_date: end, note: note.trim() || null, closed_by: actor.id })
  if (error) throw new Error(error.message)
  revalidatePath('/close-period')
  revalidatePath('/timesheet')
  revalidatePath('/request')
  revalidatePath('/approvals')
}

/** Lifts a closure (CEO only, note required). The row is kept as history. */
export async function liftClosure(id: string, note: string) {
  const actor = await requireRole(REOPEN_OVERRIDE_ROLES)
  const trimmed = note.trim()
  if (!trimmed) throw new Error('Add a note explaining why the closure is being lifted')
  const admin = createAdminClient()
  const { error } = await admin
    .from('closed_periods')
    .update({ lifted_at: new Date().toISOString(), lifted_by: actor.id, lift_note: trimmed })
    .eq('id', id)
    .is('lifted_at', null)
  if (error) throw new Error(error.message)
  revalidatePath('/close-period')
  revalidatePath('/timesheet')
  revalidatePath('/request')
  revalidatePath('/approvals')
}
