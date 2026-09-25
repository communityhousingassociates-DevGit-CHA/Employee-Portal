'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { hasPayrollAccess } from '@/lib/constants/salary-access'
import { PTO_CARRYOVER_CAP } from '@/lib/constants/accrual'
import { runAccruals, type AccrualRunSummary } from '@/lib/accruals'
import { isPeriodBoundary } from '@/lib/pay-periods'
import { parseBalanceUpdateFile, type BalanceFileRow } from '@/lib/import/balance-update-parser'
import type { Employee } from '@/types'

/** Overriding leave balances is limited to the payroll-access group (Nico, Carrileen, super admin). */
async function requireBalanceManager(): Promise<Employee> {
  const employee = await getCurrentEmployee()
  if (!employee || !hasPayrollAccess(employee)) throw new Error('Forbidden')
  return employee
}

export async function parseBalanceFileForUpdate(formData: FormData): Promise<BalanceFileRow[]> {
  await requireBalanceManager()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file uploaded')
  return parseBalanceUpdateFile(await file.arrayBuffer())
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

async function approvedLeaveSince(admin: ReturnType<typeof createAdminClient>, asOf: string) {
  const { data, error } = await admin.from('leave_requests').select('employee_id, leave_type, hours').eq('status', 'approved').gte('start_date', asOf)
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

/** Matches file rows to employees and shows exactly what would change — nothing is written. */
export async function previewBalanceUpdate(fileRows: BalanceFileRow[], asOf: string): Promise<BalancePreview> {
  await requireBalanceManager()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('Enter the "as of" date of the balances')
  const admin = createAdminClient()

  const [{ data: employees, error: empError }, { data: balances, error: balError }, deductions] = await Promise.all([
    admin.from('employees').select('id, name, email, first_name, last_name').eq('is_active', true),
    admin.from('leave_balances').select('employee_id, pto_hours, sick_hours, personal_hours'),
    approvedLeaveSince(admin, asOf),
  ])
  if (empError) throw new Error(empError.message)
  if (balError) throw new Error(balError.message)

  const byEmail = new Map((employees ?? []).map(e => [e.email.toLowerCase(), e]))
  const byName = new Map<string, typeof employees>()
  for (const e of employees ?? []) {
    const k = nameKey(`${e.first_name} ${e.last_name}`)
    byName.set(k, [...(byName.get(k) ?? []), e])
  }
  const balanceById = new Map((balances ?? []).map(b => [b.employee_id as string, b]))

  const seen = new Set<string>()
  const rows: BalancePreviewRow[] = fileRows.map(r => {
    const display = r.name || r.email || `row ${r.rowIndex + 1}`
    let emp = r.email ? byEmail.get(r.email.toLowerCase()) : undefined
    if (!emp && r.name) {
      const candidates = byName.get(nameKey(r.name)) ?? []
      if (candidates.length > 1) return { rowIndex: r.rowIndex, fileName: display, status: 'ambiguous' as const, message: 'More than one employee has this name — add an Email column', flags: [] }
      emp = candidates[0]
    }
    if (!emp) return { rowIndex: r.rowIndex, fileName: display, status: 'unmatched' as const, message: 'No active employee matches this name/email', flags: [] }
    if (seen.has(emp.id)) return { rowIndex: r.rowIndex, fileName: display, status: 'duplicate' as const, employeeId: emp.id, employeeName: emp.name, message: 'This employee appears more than once in the file', flags: [] }
    seen.add(emp.id)

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
    if (deducted.pto + deducted.sick + deducted.vacation > 0) flags.push('Approved leave since the as-of date will be re-deducted')
    if (final.pto < 0 || final.sick < 0 || final.vacation < 0) flags.push('Result would be negative')

    return { rowIndex: r.rowIndex, fileName: display, status: 'ok' as const, employeeId: emp.id, employeeName: emp.name, current, file, deducted, final, flags }
  })

  const matched = new Set(rows.filter(r => r.employeeId).map(r => r.employeeId!))
  const notInFile = (employees ?? []).filter(e => !matched.has(e.id)).map(e => ({ id: e.id, name: e.name }))
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
) {
  const actor = await requireBalanceManager()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('Enter the "as of" date of the balances')
  if (updates.length === 0) throw new Error('Nothing to apply')
  const admin = createAdminClient()

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
      batch_id: batchId, employee_id: u.employeeId, as_of: asOf, source_file: fileName || null, note: note.trim() || null, created_by: actor.id,
      old_pto: old ? Number(old.pto_hours) : null, old_sick: old ? Number(old.sick_hours) : null, old_personal: old ? Number(old.personal_hours) : null,
      new_pto: next.pto_hours, new_sick: next.sick_hours, new_personal: next.personal_hours,
    })
    applied++
  }
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
    .select('batch_id, as_of, source_file, note, created_at, creator:employees!balance_adjustments_created_by_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  const batches = new Map<string, { batchId: string; asOf: string; file: string | null; note: string | null; at: string; by: string | null; employees: number }>()
  for (const r of data ?? []) {
    const b = batches.get(r.batch_id)
    if (b) b.employees++
    else {
      const c = r.creator as unknown as { name: string } | { name: string }[] | null
      batches.set(r.batch_id, { batchId: r.batch_id, asOf: r.as_of, file: r.source_file, note: r.note, at: r.created_at, by: (Array.isArray(c) ? c[0]?.name : c?.name) ?? null, employees: 1 })
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
  revalidatePath('/admin/balances')
  revalidatePath('/dashboard')
  return summary
}
