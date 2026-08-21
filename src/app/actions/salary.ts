'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole, requireSelfOrRole } from '@/lib/auth/session'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin'] as const

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

export async function getSalaryForEmployee(employeeId: string) {
  await requireSelfOrRole(employeeId, [...MANAGER_ROLES])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employee_salaries')
    .select('id, annual_salary, effective_date, note, created_at')
    .eq('employee_id', employeeId)
    .order('effective_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAllCurrentSalaries() {
  await requireRole([...MANAGER_ROLES])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, name, email, employee_current_salary(annual_salary, effective_date, note)')
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(e => {
    const current = Array.isArray(e.employee_current_salary) ? e.employee_current_salary[0] : e.employee_current_salary
    return { id: e.id, name: e.name, email: e.email, current: current ?? null }
  })
}

export async function setSalary(employeeId: string, data: { annual_salary: number; effective_date: string; note: string }) {
  const actor = await requireRole([...MANAGER_ROLES])
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

/** Applies a salary change to multiple employees at once (e.g. an across-the-board raise). */
export async function bulkSetSalary(
  updates: { employee_id: string; annual_salary: number }[],
  effective_date: string,
  note: string
) {
  const actor = await requireRole([...MANAGER_ROLES])
  const admin = createAdminClient()
  const { error } = await admin.from('employee_salaries').insert(
    updates.map(u => ({
      employee_id: u.employee_id,
      annual_salary: u.annual_salary,
      effective_date,
      note: note || null,
      created_by: actor.id,
    }))
  )
  if (error) throw new Error(error.message)
  revalidatePath('/admin/salary')
}
