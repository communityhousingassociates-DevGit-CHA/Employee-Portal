'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, requireSuperAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { parseEmployeeWorkbook } from '@/lib/import/employee-parser'
import { parseBalanceWorkbook } from '@/lib/import/balance-parser'
import { parseSalaryWorkbook } from '@/lib/import/salary-parser'
import { buildPreview } from '@/lib/import/validate'
import type { ParsedEmployeeRow, ParsedBalanceRow, ParsedSalaryRow, ImportPreview } from '@/lib/import/types'

async function getExistingEmployees() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('employees').select('id, name, email, first_name, last_name, middle_initial')
  if (error) throw new Error(error.message)
  return data ?? []
}

/** For the Review screen: who actually has authority to commit an import. */
export async function getImportApprover(): Promise<{ isSuperAdmin: boolean; superAdminName: string | null }> {
  const me = await requireRole(['admin'])
  const admin = createAdminClient()
  const { data } = await admin.from('employees').select('name').eq('is_super_admin', true).eq('is_active', true).limit(1).maybeSingle()
  return { isSuperAdmin: me.is_super_admin, superAdminName: data?.name ?? null }
}

export async function parseEmployeeFile(formData: FormData): Promise<ParsedEmployeeRow[]> {
  await requireRole(['admin'])
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file uploaded')
  return parseEmployeeWorkbook(await file.arrayBuffer())
}

export async function parseBalanceFile(formData: FormData): Promise<ParsedBalanceRow[]> {
  await requireRole(['admin'])
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file uploaded')
  return parseBalanceWorkbook(await file.arrayBuffer())
}

export async function parseSalaryFile(formData: FormData): Promise<ParsedSalaryRow[]> {
  await requireRole(['admin'])
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file uploaded')
  return parseSalaryWorkbook(await file.arrayBuffer())
}

export async function validateImport(
  employeeRows: ParsedEmployeeRow[],
  balanceRows: ParsedBalanceRow[],
  salaryRows: ParsedSalaryRow[] = []
): Promise<ImportPreview> {
  await requireRole(['admin'])
  const existing = await getExistingEmployees()
  return buildPreview(employeeRows, balanceRows, existing, salaryRows)
}

export async function commitImport(payload: {
  employees: ParsedEmployeeRow[]
  balances: (ParsedBalanceRow & { matchedEmail: string | null })[]
  salaries: (ParsedSalaryRow & { matchedEmail: string | null })[]
}): Promise<{
  employeesCreated: number
  balancesCreated: number
  salariesCreated: number
  skipped: string[]
  createdEmployees: { id: string; name: string; email: string }[]
}> {
  const actor = await requireSuperAdmin()
  const admin = createAdminClient()

  // Never trust client state — re-validate server-side before writing anything.
  const existing = await getExistingEmployees()
  const preview = buildPreview(payload.employees, payload.balances, existing, payload.salaries)
  const badEmployees = preview.employees.filter(r => r.status === 'error')
  const badBalances = preview.balances.filter(r => r.status === 'error')
  const badSalaries = preview.salaries.filter(r => r.status === 'error')
  if (badEmployees.length > 0 || badBalances.length > 0 || badSalaries.length > 0) {
    throw new Error(`${badEmployees.length + badBalances.length + badSalaries.length} row(s) still have unresolved errors — re-validate before committing`)
  }

  const skipped: string[] = []
  const toInsert = payload.employees.filter(e => {
    const alreadyExists = existing.some(x => x.email.toLowerCase() === e.email.toLowerCase())
    if (alreadyExists) skipped.push(e.email)
    return !alreadyExists
  })

  const inserted: { id: string; name: string; email: string }[] = []
  if (toInsert.length > 0) {
    const { data, error } = await admin
      .from('employees')
      .insert(toInsert.map(e => ({
        first_name: e.first_name,
        last_name: e.last_name,
        middle_initial: e.middle_initial,
        email: e.email,
        employee_type: e.employee_type,
        role: e.role,
        staff_category: e.staff_category,
        department: e.department,
        job_title: e.job_title,
        hire_date: e.hire_date,
        address_line1: e.address_line1,
        address_line2: e.address_line2,
        city: e.city,
        state: e.state,
        postal_code: e.postal_code,
        is_active: true,
      })))
      .select('id, name, email')
    if (error) throw new Error(error.message)
    inserted.push(...(data ?? []))
  }

  // Covers both newly-created employees and anyone already on the roster —
  // so balance/salary rows can attach to either.
  const emailToId = new Map<string, string>()
  for (const e of inserted) emailToId.set(e.email.toLowerCase(), e.id)
  for (const e of existing) emailToId.set(e.email.toLowerCase(), e.id)

  const balanceRowsToInsert = payload.balances
    .filter(b => b.matchedEmail)
    .map(b => {
      const employeeId = emailToId.get(b.matchedEmail!.toLowerCase())
      if (!employeeId) return null
      return {
        employee_id: employeeId,
        pto_hours: b.ptoBalance ?? 0,
        sick_hours: b.sickBalance ?? 0,
        personal_hours: b.personalBalance ?? 0,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  // Every newly-created employee gets a leave_balances row — zeroed if no matching balance row was uploaded.
  const coveredIds = new Set(balanceRowsToInsert.map(r => r.employee_id))
  for (const emp of inserted) {
    if (!coveredIds.has(emp.id)) {
      balanceRowsToInsert.push({ employee_id: emp.id, pto_hours: 0, sick_hours: 0, personal_hours: 0 })
    }
  }

  let balancesCreated = 0
  if (balanceRowsToInsert.length > 0) {
    const { error } = await admin.from('leave_balances').insert(balanceRowsToInsert)
    if (error) throw new Error(error.message)
    balancesCreated = balanceRowsToInsert.length
  }

  const salaryRowsToInsert = payload.salaries
    .filter(s => s.matchedEmail && s.annualSalary !== null && s.effectiveDate)
    .map(s => {
      const employeeId = emailToId.get(s.matchedEmail!.toLowerCase())
      if (!employeeId) return null
      return {
        employee_id: employeeId,
        annual_salary: s.annualSalary!,
        effective_date: s.effectiveDate!,
        note: s.note,
        created_by: actor.id,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  let salariesCreated = 0
  if (salaryRowsToInsert.length > 0) {
    const { error } = await admin.from('employee_salaries').insert(salaryRowsToInsert)
    if (error) throw new Error(error.message)
    salariesCreated = salaryRowsToInsert.length
  }

  revalidatePath('/admin/users')
  revalidatePath('/admin/import')
  revalidatePath('/admin/salary')
  return { employeesCreated: inserted.length, balancesCreated, salariesCreated, skipped, createdEmployees: inserted }
}

export async function inviteEmployees(
  employeeIds: string[]
): Promise<{ invited: string[]; failed: { email: string; error: string }[] }> {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { data: employees, error } = await admin
    .from('employees')
    .select('id, email, user_id')
    .in('id', employeeIds)
  if (error) throw new Error(error.message)

  const invited: string[] = []
  const failed: { email: string; error: string }[] = []
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  for (const emp of employees ?? []) {
    if (emp.user_id) continue // already has an account
    const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(emp.email, {
      redirectTo: origin ? `${origin}/set-password` : undefined,
    })
    if (inviteError || !data.user) {
      failed.push({ email: emp.email, error: inviteError?.message ?? 'Unknown error' })
      continue
    }
    const { error: linkError } = await admin.from('employees').update({ user_id: data.user.id }).eq('id', emp.id)
    if (linkError) {
      failed.push({ email: emp.email, error: linkError.message })
      continue
    }
    invited.push(emp.email)
  }

  revalidatePath('/admin/users')
  return { invited, failed }
}
