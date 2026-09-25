'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee } from '@/lib/auth/session'
import { canViewSalaries } from '@/lib/constants/salary-access'
import type { Employee } from '@/types'

/** Salary data is limited to a named pair of people (see lib/constants/salary-access.ts), not a whole role. */
async function requireSalaryViewer(): Promise<Employee> {
  const employee = await getCurrentEmployee()
  if (!employee || !canViewSalaries(employee)) throw new Error('Forbidden')
  return employee
}

/** The signed-in employee's own current salary (always allowed — it's their own pay). */
export async function getMySalary() {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employee_current_salary')
    .select('annual_salary, effective_date, note')
    .eq('employee_id', employee.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Roster for the Salary page — deliberately WITHOUT amounts. Dollar figures are only ever sent one at a time,
 * when a viewer clicks a masked field (see revealSalary / revealSalaryEntry).
 */
export async function getAllCurrentSalaries() {
  await requireSalaryViewer()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, name, email, employee_current_salary(effective_date, note)')
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(e => {
    const current = Array.isArray(e.employee_current_salary) ? e.employee_current_salary[0] : e.employee_current_salary
    return { id: e.id, name: e.name, email: e.email, current: current ?? null }
  })
}

/** Reveals one employee's current annual salary (called when a viewer clicks the masked cell). */
export async function revealSalary(employeeId: string): Promise<number | null> {
  await requireSalaryViewer()
  const admin = createAdminClient()
  const { data, error } = await admin.from('employee_current_salary').select('annual_salary').eq('employee_id', employeeId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? Number(data.annual_salary) : null
}

/** Sum of weekly gross (annual ÷ 52) for the given employees — the Reports "estimated weekly payroll" figure, revealed on click. */
export async function revealWeeklyPayroll(employeeIds: string[]): Promise<number> {
  await requireSalaryViewer()
  if (employeeIds.length === 0) return 0
  const admin = createAdminClient()
  const { data, error } = await admin.from('employee_current_salary').select('annual_salary').in('employee_id', employeeIds)
  if (error) throw new Error(error.message)
  return (data ?? []).reduce((s, r) => s + Number(r.annual_salary) / 52, 0)
}

/** Every active employee's current annual salary at once — for the "Show all amounts" toggle. Amounts only ever leave the server here or one at a time via revealSalary. */
export async function revealAllSalaries(): Promise<Record<string, number>> {
  await requireSalaryViewer()
  const admin = createAdminClient()
  const { data, error } = await admin.from('employee_current_salary').select('employee_id, annual_salary')
  if (error) throw new Error(error.message)
  return Object.fromEntries((data ?? []).map(r => [r.employee_id as string, Number(r.annual_salary)]))
}

/** Salary history for one employee, WITHOUT amounts (each is revealed individually). */
export async function getSalaryHistory(employeeId: string) {
  await requireSalaryViewer()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employee_salaries')
    .select('id, effective_date, note, created_at, edited_at, editor:employees!employee_salaries_edited_by_fkey(name)')
    .eq('employee_id', employeeId)
    .order('effective_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(h => {
    const ed = h.editor as unknown as { name: string } | { name: string }[] | null
    return { id: h.id as string, effective_date: h.effective_date as string, note: (h.note as string | null) ?? null, created_at: h.created_at as string, edited_at: (h.edited_at as string | null) ?? null, edited_by: (Array.isArray(ed) ? ed[0]?.name : ed?.name) ?? null }
  })
}

/** The entry that is in force today (latest effective date not in the future) — what a row-level "Edit" changes. */
export async function getCurrentSalaryEntry(employeeId: string) {
  await requireSalaryViewer()
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin
    .from('employee_salaries')
    .select('id, annual_salary, effective_date, note')
    .eq('employee_id', employeeId)
    .lte('effective_date', today)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { id: data.id as string, annual_salary: Number(data.annual_salary), effective_date: data.effective_date as string, note: (data.note as string | null) ?? null }
}

/** Corrects an existing salary entry in place. Records who edited it, when, and the amount it had before. */
export async function editSalaryEntry(entryId: string, data: { annual_salary: number; effective_date: string; note: string }) {
  const actor = await requireSalaryViewer()
  if (!Number.isFinite(data.annual_salary) || data.annual_salary <= 0) throw new Error('Enter an annual salary greater than zero')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.effective_date)) throw new Error('Choose an effective date')
  const admin = createAdminClient()
  const { data: old, error: oldError } = await admin.from('employee_salaries').select('annual_salary').eq('id', entryId).single()
  if (oldError) throw new Error(oldError.message)
  const { error } = await admin.from('employee_salaries').update({
    annual_salary: data.annual_salary,
    effective_date: data.effective_date,
    note: data.note.trim() || null,
    previous_annual_salary: old.annual_salary,
    edited_by: actor.id,
    edited_at: new Date().toISOString(),
  }).eq('id', entryId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/salary')
  revalidatePath('/reports')
}

/** Reveals a single historical salary entry. */
export async function revealSalaryEntry(entryId: string): Promise<number | null> {
  await requireSalaryViewer()
  const admin = createAdminClient()
  const { data, error } = await admin.from('employee_salaries').select('annual_salary').eq('id', entryId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? Number(data.annual_salary) : null
}

export async function setSalary(employeeId: string, data: { annual_salary: number; effective_date: string; note: string }) {
  const actor = await requireSalaryViewer()
  const admin = createAdminClient()
  const { error } = await admin.from('employee_salaries').insert({
    employee_id: employeeId,
    annual_salary: data.annual_salary,
    effective_date: data.effective_date,
    note: data.note || null,
    created_by: actor.id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/salary')
}

export type BulkSalaryChange = { mode: 'set' | 'add' | 'percent'; value: number }

/**
 * Applies a salary change to several employees at once (e.g. an across-the-board raise). The new amounts are
 * computed here from each person's current salary, so the browser never needs the existing figures.
 */
export async function bulkSetSalary(employeeIds: string[], change: BulkSalaryChange, effective_date: string, note: string) {
  const actor = await requireSalaryViewer()
  if (!Number.isFinite(change.value) || (change.mode !== 'set' && change.value === 0)) throw new Error('Enter an amount')
  const admin = createAdminClient()

  const { data: employees, error: empError } = await admin.from('employees').select('id, name').in('id', employeeIds)
  if (empError) throw new Error(empError.message)
  const { data: current, error: curError } = await admin.from('employee_current_salary').select('employee_id, annual_salary').in('employee_id', employeeIds)
  if (curError) throw new Error(curError.message)
  const currentById = new Map((current ?? []).map(c => [c.employee_id as string, Number(c.annual_salary)]))

  const updates: { employee_id: string; annual_salary: number }[] = []
  const skipped: string[] = []
  for (const emp of employees ?? []) {
    let amount: number | null
    if (change.mode === 'set') amount = change.value
    else {
      const base = currentById.get(emp.id)
      amount = base === undefined ? null : change.mode === 'add' ? base + change.value : Math.round(base * (1 + change.value / 100) * 100) / 100
    }
    if (amount === null) skipped.push(emp.name)
    else updates.push({ employee_id: emp.id, annual_salary: amount })
  }
  if (updates.length === 0) throw new Error('No eligible employees to update — for %/add mode, selected employees need an existing current salary.')

  const { error } = await admin.from('employee_salaries').insert(
    updates.map(u => ({ ...u, effective_date, note: note || null, created_by: actor.id })),
  )
  if (error) throw new Error(error.message)
  revalidatePath('/admin/salary')
  return { updated: updates.length, skipped }
}
