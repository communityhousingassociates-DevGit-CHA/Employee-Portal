'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { calcTier } from '@/lib/constants/accrual'
import { requireRole } from '@/lib/auth/session'

export async function addEmployee(data: {
  first_name: string
  last_name: string
  middle_initial: string | null
  email: string
  employee_type: string
  role: string
  staff_category: string
  department: string
  job_title: string
  hire_date: string
  grant_id: string | null
}) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('employees').insert({
    first_name: data.first_name,
    last_name: data.last_name,
    middle_initial: data.middle_initial || null,
    email: data.email,
    employee_type: data.employee_type.toLowerCase(),
    role: data.role,
    staff_category: data.staff_category,
    department: data.department || null,
    job_title: data.job_title || null,
    hire_date: data.hire_date,
    grant_id: data.grant_id,
    is_active: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function editEmployee(id: string, data: {
  first_name: string
  last_name: string
  middle_initial: string | null
  email: string
  employee_type: string
  role: string
  staff_category: string
  department: string
  job_title: string
  hire_date: string
  grant_id: string | null
}) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({
    first_name: data.first_name,
    last_name: data.last_name,
    middle_initial: data.middle_initial || null,
    email: data.email,
    employee_type: data.employee_type.toLowerCase(),
    role: data.role,
    staff_category: data.staff_category,
    department: data.department || null,
    job_title: data.job_title || null,
    hire_date: data.hire_date,
    grant_id: data.grant_id,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function archiveEmployee(id: string) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_active: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function restoreEmployee(id: string) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_active: true }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function deleteEmployee(id: string) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('employees').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function getEmployees() {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, employee_number, first_name, last_name, middle_initial, name, email, role, employee_type, staff_category, department, job_title, hire_date, avatar_url, is_active, grant_id, grant:grants(name)')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(e => {
    const { tier, ptoRate } = calcTier(e.hire_date)
    const grant = Array.isArray(e.grant) ? e.grant[0] : e.grant
    return { ...e, tier, accrual: ptoRate, status: e.is_active ? 'active' : 'archived', grant_name: grant?.name ?? null }
  })
}

/** Read-only staff directory for the (portal) Employees page — visible to ceo/admin. */
export async function getEmployeeDirectory() {
  await requireRole(['ceo', 'admin'])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, employee_number, first_name, last_name, middle_initial, name, email, employee_type, department, job_title, hire_date, is_active, leave_balances(pto_hours, sick_hours, personal_hours)')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(e => {
    const { tier, ptoRate } = calcTier(e.hire_date)
    const bal = Array.isArray(e.leave_balances) ? e.leave_balances[0] : e.leave_balances
    return {
      ...e,
      tier,
      accrual: ptoRate,
      status: e.is_active ? 'active' : 'archived',
      pto_bal: bal ? Number(bal.pto_hours) : 0,
      sick_bal: bal ? Number(bal.sick_hours) : 0,
      personal_bal: bal ? Number(bal.personal_hours) : 0,
    }
  })
}
