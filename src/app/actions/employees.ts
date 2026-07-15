'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

function calcTier(hireDate: string): { tier: string; accrual: number } {
  const months = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 13)  return { tier: '0–12 mo',  accrual: 4.62 }
  if (months < 25)  return { tier: '13–24 mo', accrual: 5.08 }
  if (months < 37)  return { tier: '25–36 mo', accrual: 5.54 }
  return             { tier: '36+ mo',  accrual: 6.00 }
}

export async function addEmployee(data: {
  name: string
  email: string
  employee_type: string
  role: string
  department: string
  job_title: string
  hire_date: string
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('employees').insert({
    name: data.name,
    email: data.email,
    employee_type: data.employee_type.toLowerCase(),
    role: data.role,
    department: data.department || null,
    job_title: data.job_title || null,
    hire_date: data.hire_date,
    is_active: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function editEmployee(id: string, data: {
  name: string
  email: string
  employee_type: string
  role: string
  department: string
  job_title: string
  hire_date: string
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({
    name: data.name,
    email: data.email,
    employee_type: data.employee_type.toLowerCase(),
    role: data.role,
    department: data.department || null,
    job_title: data.job_title || null,
    hire_date: data.hire_date,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function archiveEmployee(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_active: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function restoreEmployee(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_active: true }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function deleteEmployee(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('employees').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function getEmployees() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, name, email, role, employee_type, department, job_title, hire_date, avatar_url, is_active')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(e => ({
    ...e,
    ...calcTier(e.hire_date),
    status: e.is_active ? 'active' : 'archived',
  }))
}
