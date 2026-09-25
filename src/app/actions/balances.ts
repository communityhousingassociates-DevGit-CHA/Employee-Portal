'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { hasPayrollAccess } from '@/lib/constants/salary-access'
import { PTO_CARRYOVER_CAP } from '@/lib/constants/accrual'
import { runAccruals, type AccrualRunSummary } from '@/lib/accruals'
import { applyDueLeaveDeductions } from '@/lib/leave-deductions'
import { storeBalanceFile, signedBalanceFileUrl } from '@/lib/balance-files'
import { balancesAsOf } from '@/lib/balance-history'
import { todayET } from '@/lib/pay-periods'
import { isPeriodBoundary } from '@/lib/pay-periods'
import { parseBalanceUpdateFile, readTemplateAsOf, type BalanceFileRow } from '@/lib/import/balance-update-parser'
import type { Employee } from '@/types'

/** Overriding leave balances is limited to the payroll-access group (Nico, Carrileen, super admin). */
async function requireBalanceManager(): Promise<Employee> {
  const employee = await getCurrentEmployee()
  if (!employee || !hasPayrollAccess(employee)) throw new Error('Forbidden')
  return employee
}

export type BulkLockState = { locked: boolean; at: string | null; by: string | null; lastUnlockReason: string | null }

/** Once balances are validated they're locked against bulk file overrides; only single adjustments remain. */
export async function getBulkLockState(): Promise<BulkLockState> {
  await requireBalanceManager()
  const admin = createAdminClient()
  const { data } = await admin
    .from('accrual_settings')
    .select('bulk_override_locked, bulk_override_locked_at, bulk_override_unlock_reason, locker:employees!accrual_settings_bulk_override_locked_by_fkey(name)')
    .maybeSingle()
  const l = data?.locker as unknown as { name: string } | { name: string }[] | null | undefined
  return {
    locked: !!data?.bulk_override_locked,
    at: (data?.bulk_override_locked_at as string | null) ?? null,
    by: (Array.isArray(l) ? l[0]?.name : l?.name) ?? null,
    lastUnlockReason: (data?.bulk_override_unlock_reason as string | null) ?? null,
  }
}

/** Lock (no reason needed) or unlock (reason required, recorded) bulk balance overrides. */
export async function setBulkOverrideLock(locked: boolean, reason: string) {
  const actor = await requireBalanceManager()
  if (!locked && !reason.trim()) throw new Error('Give a reason for unlocking bulk overrides')
  const admin = createAdminClient()
  const { error } = await admin
    .from('accrual_settings')
    .update(locked
      ? { bulk_override_locked: true, bulk_override_locked_at: new Date().toISOString(), bulk_override_locked_by: actor.id }
      : { bulk_override_locked: false, bulk_override_unlock_reason: `${reason.trim()} (${actor.name}, ${new Date().toISOString().slice(0, 10)})` })
    .eq('id', true)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/balances')
}

/** Parses the file and, if it's CHA's template, reports the As Of Date typed into it so the screen can pre-fill (not replace) the date. */
export async function parseBalanceFileForUpdate(formData: FormData): Promise<{ rows: BalanceFileRow[]; fileAsOf: string | null; filePath: string }> {
  await requireBalanceManager()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file uploaded')
  const buffer = await file.arrayBuffer()
  const rows = await parseBalanceUpdateFile(buffer)
  // Keep the original: what was sent, and the date written on it, must stay retrievable.
  const filePath = await storeBalanceFile(createAdminClient(), file, formData.get('purpose') === 'compare' ? 'compare' : 'override')
  return { rows, fileAsOf: readTemplateAsOf(buffer), filePath }
}

/** A balance file must say what date it describes, and that date can't be in the future. */
function assertAsOf(asOf: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('Enter the date these balances are as of')
  if (asOf > todayET()) throw new Error('The “as of” date can’t be in the future')
}

type Buckets = { pto: number; sick: number; vacation: number }

export type BalancePreviewRow = {
  rowIndex: number
  fileName: string
  status: 'ok' | 'unmatched' | 'ambiguous' | 'duplicate'
  message?: string
  employeeId?: string
  employeeName?: string
  current?: Buckets
  file?: Buckets
  /** Approved leave dated on/after the as-of date — not in the file yet, so it's taken back off after the override. */
  deducted?: Buckets
  final?: Buckets
  flags: string[]
}

export type BalancePreview = { rows: BalancePreviewRow[]; notInFile: { id: string; name: string }[] }

const clean = (s: string) => s.toLowerCase().replace(/[.,'’]/g, ' ').replace(/\s+/g, ' ').trim()

/** "First Last", "First M. Last", and "Last, First [M.]" all reduce to "first last". */
function nameKey(raw: string): string {
  if (raw.includes(',')) {
    const [last, rest] = raw.split(',')
    const first = clean(rest ?? '').split(' ')[0] ?? ''
    return `${first} ${clean(last ?? '').split(' ').pop() ?? ''}`.trim()
  }
  const parts = clean(raw).split(' ').filter(Boolean)
  return parts.length <= 1 ? parts.join(' ') : `${parts[0]} ${parts[parts.length - 1]}`
}

// Approved leave that has already begun (on/after the as-of date, up to today) is missing from the file, so it comes back off
// the overridden balance. Leave still in the future stays RESERVED — it's deducted on its start date, not now.
async function approvedLeaveSince(admin: ReturnType<typeof createAdminClient>, asOf: string) {
  const { data, error } = await admin.from('leave_requests').select('employee_id, leave_type, hours').eq('status', 'approved').gte('start_date', asOf).lte('start_date', todayET())
  if (error) throw new Error(error.message)
  const byEmployee = new Map<string, Buckets>()
  for (const r of data ?? []) {
    const b = byEmployee.get(r.employee_id) ?? { pto: 0, sick: 0, vacation: 0 }
    if (r.leave_type === 'PTO') b.pto += Number(r.hours)
    else if (r.leave_type === 'Sick') b.sick += Number(r.hours)
    else if (r.leave_type === 'Personal') b.vacation += Number(r.hours)
    byEmployee.set(r.employee_id, b)
  }
  return byEmployee
}

type MatchedRow = { row: BalanceFileRow; emp: { id: string; name: string } }
type UnmatchedRow = { rowIndex: number; fileName: string; status: 'unmatched' | 'ambiguous' | 'duplicate'; message: string; employeeId?: string; employeeName?: string }

/** Matches file rows to active employees by email, then by first + last name. Shared by the override preview and the Sage comparison. */
async function matchFileRows(admin: ReturnType<typeof createAdminClient>, fileRows: BalanceFileRow[]) {
  const { data: employees, error } = await admin.from('employees').select('id, name, email, first_name, last_name').eq('is_active', true)
  if (error) throw new Error(error.message)

  const byEmail = new Map((employees ?? []).map(e => [e.email.toLowerCase(), e]))
  const byName = new Map<string, typeof employees>()
  for (const e of employees ?? []) {
    const k = nameKey(`${e.first_name} ${e.last_name}`)
    byName.set(k, [...(byName.get(k) ?? []), e])
  }

  const seen = new Set<string>()
  const matched: MatchedRow[] = []
  const problems: UnmatchedRow[] = []
  for (const r of fileRows) {
    const display = r.name || r.email || `row ${r.rowIndex + 1}`
    let emp = r.email ? byEmail.get(r.email.toLowerCase()) : undefined
    if (!emp && r.name) {
      const candidates = byName.get(nameKey(r.name)) ?? []
      if (candidates.length > 1) { problems.push({ rowIndex: r.rowIndex, fileName: display, status: 'ambiguous', message: 'More than one employee has this name — add an Email column' }); continue }
      emp = candidates[0]
    }
    if (!emp) { problems.push({ rowIndex: r.rowIndex, fileName: display, status: 'unmatched', message: 'No active employee matches this name/email' }); continue }
    if (seen.has(emp.id)) { problems.push({ rowIndex: r.rowIndex, fileName: display, status: 'duplicate', employeeId: emp.id, employeeName: emp.name, message: 'This employee appears more than once in the file' }); continue }
    seen.add(emp.id)
    matched.push({ row: r, emp: { id: emp.id, name: emp.name } })
  }
  const notInFile = (employees ?? []).filter(e => !seen.has(e.id)).map(e => ({ id: e.id, name: e.name }))
  return { matched, problems, notInFile }
}

/** Matches file rows to employees and shows exactly what would change — nothing is written. */
export async function previewBalanceUpdate(fileRows: BalanceFileRow[], asOf: string): Promise<BalancePreview> {
  await requireBalanceManager()
  assertAsOf(asOf)
  const admin = createAdminClient()

  const [{ matched, problems, notInFile }, { data: balances, error: balError }, deductions] = await Promise.all([
    matchFileRows(admin, fileRows),
    admin.from('leave_balances').select('employee_id, pto_hours, sick_hours, personal_hours'),
    approvedLeaveSince(admin, asOf),
  ])
  if (balError) throw new Error(balError.message)
  const balanceById = new Map((balances ?? []).map(b => [b.employee_id as string, b]))

  const okRows: BalancePreviewRow[] = matched.map(({ row: r, emp }) => {
    const display = r.name || r.email || `row ${r.rowIndex + 1}`
    const cur = balanceById.get(emp.id)
    const current: Buckets = { pto: Number(cur?.pto_hours ?? 0), sick: Number(cur?.sick_hours ?? 0), vacation: Number(cur?.personal_hours ?? 0) }
    // A blank cell in the file means "no change", never "zero it out".
    const file: Buckets = { pto: r.pto ?? current.pto, sick: r.sick ?? current.sick, vacation: r.vacation ?? current.vacation }
    const deducted = deductions.get(emp.id) ?? { pto: 0, sick: 0, vacation: 0 }
    const final: Buckets = { pto: file.pto - deducted.pto, sick: file.sick - deducted.sick, vacation: file.vacation - deducted.vacation }

    const flags: string[] = []
    if (r.pto === null || r.sick === null || r.vacation === null) flags.push('Blank balance kept as current')
    for (const [label, v] of [['PTO', file.pto], ['Sick', file.sick], ['Vacation', file.vacation]] as const) {
      if (v < 0) flags.push(`${label} is negative in the file`)
    }
    if (file.pto > PTO_CARRYOVER_CAP) flags.push(`PTO over the ${PTO_CARRYOVER_CAP}-hr cap`)
    for (const [label, a, b] of [['PTO', current.pto, file.pto], ['Sick', current.sick, file.sick], ['Vacation', current.vacation, file.vacation]] as const) {
      if (Math.abs(a - b) >= 40) flags.push(`${label} changes by ${Math.round((b - a) * 100) / 100} hrs`)
    }
    if (deducted.pto + deducted.sick + deducted.vacation > 0) flags.push('Leave already taken since the as-of date will be re-deducted')
    if (final.pto < 0 || final.sick < 0 || final.vacation < 0) flags.push('Result would be negative')

    return { rowIndex: r.rowIndex, fileName: display, status: 'ok' as const, employeeId: emp.id, employeeName: emp.name, current, file, deducted, final, flags }
  })

  const rows: BalancePreviewRow[] = [...okRows, ...problems.map(p => ({ ...p, flags: [] as string[] }))].sort((a, b) => a.rowIndex - b.rowIndex)
  return { rows, notInFile }
}

/**
 * Overrides balances with the file's totals (as of `asOf`), then takes back off any leave already approved in the
 * portal for dates on/after `asOf`. One audit row per employee (before/after), one batch id per run. Recomputed here —
 * the browser only says which employees and which file values.
 */
export async function applyBalanceUpdate(
  updates: { employeeId: string; pto: number; sick: number; vacation: number }[],
  asOf: string,
  note: string,
  fileName: string,
  filePath: string | null = null,
) {
  const actor = await requireBalanceManager()
  assertAsOf(asOf)
  if (updates.length === 0) throw new Error('Nothing to apply')
  const admin = createAdminClient()
  if ((await getBulkLockState()).locked) {
    throw new Error('Bulk overrides are locked because balances have been validated. Use “Adjust one balance” for a correction, or unlock with a reason.')
  }

  for (const u of updates) {
    if (![u.pto, u.sick, u.vacation].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Balances must be zero or positive numbers')
  }

  const ids = updates.map(u => u.employeeId)
  const [{ data: balances, error: balError }, { data: employees, error: empError }, deductions] = await Promise.all([
    admin.from('leave_balances').select('employee_id, pto_hours, sick_hours, personal_hours').in('employee_id', ids),
    admin.from('employees').select('id').in('id', ids).eq('is_active', true),
    approvedLeaveSince(admin, asOf),
  ])
  if (balError) throw new Error(balError.message)
  if (empError) throw new Error(empError.message)
  const valid = new Set((employees ?? []).map(e => e.id as string))
  const existing = new Map((balances ?? []).map(b => [b.employee_id as string, b]))

  const batchId = randomUUID()
  const audit: Record<string, unknown>[] = []
  let applied = 0
  for (const u of updates) {
    if (!valid.has(u.employeeId)) continue
    const d = deductions.get(u.employeeId) ?? { pto: 0, sick: 0, vacation: 0 }
    const next = { pto_hours: u.pto - d.pto, sick_hours: u.sick - d.sick, personal_hours: u.vacation - d.vacation }
    const old = existing.get(u.employeeId)

    const { error } = old
      ? await admin.from('leave_balances').update({ ...next, updated_at: new Date().toISOString() }).eq('employee_id', u.employeeId)
      : await admin.from('leave_balances').insert({ employee_id: u.employeeId, ...next })
    if (error) throw new Error(error.message)

    audit.push({
      batch_id: batchId, employee_id: u.employeeId, as_of: asOf, source_file: fileName || null, source_file_path: filePath, note: note.trim() || null, created_by: actor.id,
      old_pto: old ? Number(old.pto_hours) : null, old_sick: old ? Number(old.sick_hours) : null, old_personal: old ? Number(old.personal_hours) : null,
      new_pto: next.pto_hours, new_sick: next.sick_hours, new_personal: next.personal_hours,
    })
    applied++
  }
  // Re-sync deduction bookkeeping with the new balances: leave already begun (and re-deducted above) is stamped deducted;
  // leave still in the future goes back to reserved so it comes off on its start date.
  const balanceTypes = ['PTO', 'Sick', 'Personal']
  const nowIso = new Date().toISOString()
  await admin.from('leave_requests').update({ balance_deducted_at: nowIso }).eq('status', 'approved').in('employee_id', ids).in('leave_type', balanceTypes).gte('start_date', asOf).lte('start_date', todayET())
  await admin.from('leave_requests').update({ balance_deducted_at: null }).eq('status', 'approved').in('employee_id', ids).in('leave_type', balanceTypes).gt('start_date', todayET())

  const { error: auditError } = await admin.from('balance_adjustments').insert(audit)
  if (auditError) console.error('applyBalanceUpdate: audit insert failed', auditError.message)

  revalidatePath('/admin/balances')
  revalidatePath('/dashboard')
  revalidatePath('/request')
  return { batchId, applied }
}

export async function getBalanceUpdateHistory() {
  await requireBalanceManager()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('balance_adjustments')
    .select('batch_id, as_of, source_file, source_file_path, note, kind, created_at, creator:employees!balance_adjustments_created_by_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  const batches = new Map<string, { batchId: string; asOf: string; file: string | null; filePath: string | null; note: string | null; kind: string; at: string; by: string | null; employees: number }>()
  for (const r of data ?? []) {
    const b = batches.get(r.batch_id)
    if (b) b.employees++
    else {
      const c = r.creator as unknown as { name: string } | { name: string }[] | null
      batches.set(r.batch_id, { batchId: r.batch_id, asOf: r.as_of, file: r.source_file, filePath: (r.source_file_path as string | null) ?? null, note: r.note, kind: r.kind, at: r.created_at, by: (Array.isArray(c) ? c[0]?.name : c?.name) ?? null, employees: 1 })
    }
  }
  return [...batches.values()].slice(0, 10)
}

export type AccrualState = {
  enabled: boolean
  firstPeriodStart: string | null
  cronConfigured: boolean
  periodsCredited: number
  lastCreditedPeriod: string | null
}

export async function getAccrualState(): Promise<AccrualState> {
  await requireBalanceManager()
  const admin = createAdminClient()
  const [{ data: settings }, { data: log }] = await Promise.all([
    admin.from('accrual_settings').select('enabled, first_period_start').maybeSingle(),
    admin.from('accrual_log').select('period_start').order('period_start', { ascending: false }).limit(2000),
  ])
  const periods = new Set((log ?? []).map(l => l.period_start as string))
  return {
    enabled: !!settings?.enabled,
    firstPeriodStart: settings?.first_period_start ?? null,
    cronConfigured: !!process.env.CRON_SECRET,
    periodsCredited: periods.size,
    lastCreditedPeriod: log?.[0]?.period_start ?? null,
  }
}

/** Switch accruals on/off and choose the first pay period the portal should accrue (must be a real period start). */
export async function saveAccrualSettings(firstPeriodStart: string | null, enabled: boolean) {
  const actor = await requireBalanceManager()
  if (enabled) {
    if (!firstPeriodStart || !isPeriodBoundary(firstPeriodStart)) throw new Error('Choose the first pay period to accrue')
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('accrual_settings')
    .update({ enabled, first_period_start: firstPeriodStart, updated_by: actor.id, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/balances')
}

/** Runs the accrual catch-up immediately (the daily job does the same thing on its own once switched on). */
export async function runAccrualsNow(): Promise<AccrualRunSummary> {
  await requireBalanceManager()
  const admin = createAdminClient()
  const { data: settings, error } = await admin.from('accrual_settings').select('enabled, first_period_start').maybeSingle()
  if (error) throw new Error(error.message)
  if (!settings?.enabled || !settings.first_period_start) throw new Error('Switch accruals on first')
  const summary = await runAccruals(admin, settings.first_period_start)
  await applyDueLeaveDeductions(admin).catch(e => summary.errors.push(`leave deductions: ${e instanceof Error ? e.message : e}`))
  revalidatePath('/admin/balances')
  revalidatePath('/dashboard')
  return summary
}


// ------------------------------------------------------------------------------------------------------------------
// Reconciliation with Sage: closing snapshots, compare-only mode, and manual adjustments
// ------------------------------------------------------------------------------------------------------------------

export type SnapshotRow = {
  employeeId: string
  name: string
  snapshot: Buckets
  live: Buckets
  /** What moved the live balance since the snapshot date. */
  since: { accrued: Buckets; leaveTaken: Buckets; adjustments: Buckets }
}

/** The latest closing snapshot per employee beside the live balance — "at last close" vs "today". */
export async function getSnapshotOverview(): Promise<{ asOf: string | null; rows: SnapshotRow[] }> {
  await requireBalanceManager()
  const admin = createAdminClient()
  const { data: latest } = await admin.from('balance_snapshots').select('as_of').order('as_of', { ascending: false }).limit(1)
  const asOf = latest?.[0]?.as_of as string | undefined
  if (!asOf) return { asOf: null, rows: [] }

  const [{ data: snaps, error }, history, { data: emps }] = await Promise.all([
    admin.from('balance_snapshots').select('employee_id, pto, sick, vacation').eq('as_of', asOf),
    balancesAsOf(admin, asOf),
    admin.from('employees').select('id, name').eq('is_active', true),
  ])
  if (error) throw new Error(error.message)
  const nameById = new Map((emps ?? []).map(e => [e.id as string, e.name as string]))

  const rows: SnapshotRow[] = (snaps ?? []).flatMap(sn => {
    const h = history.get(sn.employee_id as string)
    if (!h) return []
    return [{
      employeeId: sn.employee_id as string,
      name: nameById.get(sn.employee_id as string) ?? 'Unknown',
      snapshot: { pto: Number(sn.pto), sick: Number(sn.sick), vacation: Number(sn.vacation) },
      live: h.live,
      since: h.since,
    }]
  }).sort((a, b) => a.name.localeCompare(b.name))
  return { asOf, rows }
}

export type ComparisonRow = {
  rowIndex: number
  fileName: string
  employeeId: string
  employeeName: string
  portal: Buckets
  file: Buckets
  variance: Buckets // file − portal, per bucket
}

export type ComparisonResult = {
  asOf: string
  source: 'snapshot' | 'reconstructed'
  rows: ComparisonRow[]
  problems: { fileName: string; message: string }[]
  notInFile: string[]
}

/**
 * Compare-only: lines a Sage balance file up against the portal's balances AS OF the same date (the closing snapshot if
 * one exists for it, otherwise rebuilt from history) and reports the differences. Nothing is changed.
 */
export async function compareBalancesToSage(fileRows: BalanceFileRow[], asOf: string): Promise<ComparisonResult> {
  await requireBalanceManager()
  assertAsOf(asOf)
  const admin = createAdminClient()

  const [{ matched, problems, notInFile }, { data: snaps }] = await Promise.all([
    matchFileRows(admin, fileRows),
    admin.from('balance_snapshots').select('employee_id, pto, sick, vacation').eq('as_of', asOf),
  ])
  const snapById = new Map((snaps ?? []).map(sn => [sn.employee_id as string, { pto: Number(sn.pto), sick: Number(sn.sick), vacation: Number(sn.vacation) }]))
  const rebuilt = snapById.size > 0 ? null : await balancesAsOf(admin, asOf, matched.map(m => m.emp.id))

  const round = (n: number) => Math.round(n * 100) / 100
  const rows: ComparisonRow[] = matched.map(({ row, emp }) => {
    const portal = snapById.get(emp.id) ?? rebuilt?.get(emp.id)?.asOf ?? { pto: 0, sick: 0, vacation: 0 }
    const file: Buckets = { pto: row.pto ?? portal.pto, sick: row.sick ?? portal.sick, vacation: row.vacation ?? portal.vacation }
    return {
      rowIndex: row.rowIndex, fileName: row.name || row.email || `row ${row.rowIndex + 1}`, employeeId: emp.id, employeeName: emp.name, portal, file,
      variance: { pto: round(file.pto - portal.pto), sick: round(file.sick - portal.sick), vacation: round(file.vacation - portal.vacation) },
    }
  })
  return { asOf, source: snapById.size > 0 ? 'snapshot' : 'reconstructed', rows, problems: problems.map(p => ({ fileName: p.fileName, message: p.message })), notInFile: notInFile.map(e => e.name) }
}

/**
 * Posts a hand-entered correction: changes each balance by the given number of hours (positive or negative), records
 * who/why, and never touches closed timesheets or leave requests. This is the home for prior-period corrections and for
 * variances found against Sage.
 */
export async function postBalanceAdjustments(
  items: { employeeId: string; pto: number; sick: number; vacation: number }[],
  effectiveDate: string,
  reason: string,
) {
  const actor = await requireBalanceManager()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new Error('Choose the date the correction is effective')
  const why = reason.trim()
  if (!why) throw new Error('Give a reason for the adjustment')
  const changes = items.filter(i => [i.pto, i.sick, i.vacation].every(n => Number.isFinite(n)) && (i.pto !== 0 || i.sick !== 0 || i.vacation !== 0))
  if (changes.length === 0) throw new Error('Nothing to adjust — every change is zero')

  const admin = createAdminClient()
  const ids = changes.map(c => c.employeeId)
  const [{ data: balances, error: balError }, { data: employees, error: empError }] = await Promise.all([
    admin.from('leave_balances').select('employee_id, pto_hours, sick_hours, personal_hours').in('employee_id', ids),
    admin.from('employees').select('id').in('id', ids).eq('is_active', true),
  ])
  if (balError) throw new Error(balError.message)
  if (empError) throw new Error(empError.message)
  const valid = new Set((employees ?? []).map(e => e.id as string))
  const current = new Map((balances ?? []).map(b => [b.employee_id as string, b]))

  const batchId = randomUUID()
  const audit: Record<string, unknown>[] = []
  for (const c of changes) {
    if (!valid.has(c.employeeId)) continue
    const old = current.get(c.employeeId)
    const next = {
      pto_hours: Number(old?.pto_hours ?? 0) + c.pto,
      sick_hours: Number(old?.sick_hours ?? 0) + c.sick,
      personal_hours: Number(old?.personal_hours ?? 0) + c.vacation,
    }
    const { error } = old
      ? await admin.from('leave_balances').update({ ...next, updated_at: new Date().toISOString() }).eq('employee_id', c.employeeId)
      : await admin.from('leave_balances').insert({ employee_id: c.employeeId, ...next })
    if (error) throw new Error(error.message)
    audit.push({
      batch_id: batchId, kind: 'adjustment', reason: why, note: why, employee_id: c.employeeId, as_of: effectiveDate, created_by: actor.id,
      old_pto: Number(old?.pto_hours ?? 0), old_sick: Number(old?.sick_hours ?? 0), old_personal: Number(old?.personal_hours ?? 0),
      new_pto: next.pto_hours, new_sick: next.sick_hours, new_personal: next.personal_hours,
    })
  }
  const { error: auditError } = await admin.from('balance_adjustments').insert(audit)
  if (auditError) console.error('postBalanceAdjustments: audit insert failed', auditError.message)

  revalidatePath('/admin/balances')
  revalidatePath('/dashboard')
  return { applied: audit.length }
}

/** Active employees for the manual-adjustment picker. */
export async function getAdjustableEmployees() {
  await requireBalanceManager()
  const admin = createAdminClient()
  const { data, error } = await admin.from('employees').select('id, name').eq('is_active', true).order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; name: string }[]
}

/** A short-lived download link for a stored balance file (payroll-access group only). */
export async function getBalanceFileUrl(path: string): Promise<string> {
  await requireBalanceManager()
  return signedBalanceFileUrl(createAdminClient(), path)
}
