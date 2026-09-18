'use server'

import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { calcTier } from '@/lib/constants/accrual'
import { requireRole, requireSuperAdmin } from '@/lib/auth/session'
import type { Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

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

/**
 * Sends a Supabase password-recovery email to an employee's own address —
 * lets an admin/super admin unblock a locked-out user without ever seeing
 * or setting their password directly. Employee sets the new password
 * themselves via the same /set-password flow used for invites.
 */
export async function sendPasswordReset(id: string) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { data: employee, error } = await admin
    .from('employees')
    .select('email, user_id')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  if (!employee.user_id) throw new Error('This employee has not been invited yet — no account to reset.')

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { error: resetError } = await admin.auth.resetPasswordForEmail(employee.email, {
    redirectTo: origin ? `${origin}/set-password` : undefined,
  })
  if (resetError) throw new Error(resetError.message)
}

/**
 * Sets a temporary password directly (instead of emailing a reset link) —
 * for handing credentials to an employee out of band. Flags the account so
 * the portal forces a real password change once they've signed in 3 times
 * with it (see middleware.ts + /change-password). Returns the plaintext
 * password once — it is never stored and cannot be retrieved again, so the
 * caller must show it immediately and hand it to the employee securely.
 */
export async function setTemporaryPassword(id: string): Promise<string> {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { data: employee, error } = await admin
    .from('employees')
    .select('user_id')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  if (!employee.user_id) throw new Error('This employee has not been invited yet — no account to set a password for.')

  const tempPassword = `CHA-${randomBytes(6).toString('hex')}!`
  const { error: pwError } = await admin.auth.admin.updateUserById(employee.user_id, { password: tempPassword })
  if (pwError) throw new Error(pwError.message)

  const { error: flagError } = await admin
    .from('employees')
    .update({ force_password_change: true, login_count: 0 })
    .eq('id', id)
  if (flagError) throw new Error(flagError.message)

  return tempPassword
}

export type InviteStatus = 'not_invited' | 'invited' | 'active'

/** Every auth user's id → whether they have ever signed in. */
async function getSignInMap(): Promise<Map<string, boolean>> {
  const admin = createAdminClient()
  const map = new Map<string, boolean>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    for (const u of data.users) map.set(u.id, !!u.last_sign_in_at)
    if (data.users.length < 1000) break
  }
  return map
}

export async function getEmployees() {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, employee_number, first_name, last_name, middle_initial, name, email, role, employee_type, staff_category, department, job_title, hire_date, avatar_url, is_active, is_super_admin, user_id, grant_id, grant:grants(name)')
    .order('name')
  if (error) throw new Error(error.message)
  const signedIn = await getSignInMap()
  return (data ?? []).map(e => {
    const { tier, ptoRate } = calcTier(e.hire_date)
    const grant = Array.isArray(e.grant) ? e.grant[0] : e.grant
    const invite_status: InviteStatus = !e.user_id ? 'not_invited' : signedIn.get(e.user_id) ? 'active' : 'invited'
    return { ...e, tier, accrual: ptoRate, status: e.is_active ? 'active' : 'archived', grant_name: grant?.name ?? null, invite_status }
  })
}

/**
 * Sends portal invite emails to employees who haven't signed in yet —
 * first-time invites for people never invited, and re-sends for people whose
 * invite went unused (expired, lost, or filtered as spam). Super admin only,
 * same as the post-import invite step, since these are real emails.
 *
 * Re-sending: Supabase refuses to invite an email that already has an auth
 * user, so an invited-but-never-signed-in account is replaced with a fresh
 * one. That's only done after confirming via last_sign_in_at that the person
 * has never signed in — an account that has been used is never touched.
 */
export async function sendInvites(
  employeeIds: string[]
): Promise<{ invited: string[]; failed: { email: string; error: string }[]; skipped: string[] }> {
  await requireSuperAdmin()
  const admin = createAdminClient()
  const { data: employees, error } = await admin
    .from('employees')
    .select('id, email, first_name, user_id, is_active')
    .in('id', employeeIds)
  if (error) throw new Error(error.message)

  const invited: string[] = []
  const failed: { email: string; error: string }[] = []
  const skipped: string[] = []
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  for (const emp of employees ?? []) {
    if (!emp.is_active) { skipped.push(emp.email); continue }

    if (emp.user_id) {
      const { data: existing, error: getError } = await admin.auth.admin.getUserById(emp.user_id)
      if (getError) { failed.push({ email: emp.email, error: getError.message }); continue }
      if (existing.user?.last_sign_in_at) { skipped.push(emp.email); continue } // already using the portal

      const { error: unlinkError } = await admin.from('employees').update({ user_id: null }).eq('id', emp.id)
      if (unlinkError) { failed.push({ email: emp.email, error: unlinkError.message }); continue }
      const { error: deleteError } = await admin.auth.admin.deleteUser(emp.user_id)
      if (deleteError) {
        await admin.from('employees').update({ user_id: emp.user_id }).eq('id', emp.id)
        failed.push({ email: emp.email, error: deleteError.message })
        continue
      }
    }

    const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(emp.email, {
      data: { first_name: emp.first_name }, // fills "Hello {{ .Data.first_name }}" in the invite email template
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
  return { invited, failed, skipped }
}

/** Bulk archive/restore. Never applies to the caller's own row, so an admin can't lock themself out. */
export async function setEmployeesActive(ids: string[], active: boolean) {
  const me = await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_active: active }).in('id', ids.filter(id => id !== me.id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

/** Bulk delete. Never applies to the caller's own row or to any super admin. */
export async function deleteEmployees(ids: string[]) {
  const me = await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('employees').delete().in('id', ids.filter(id => id !== me.id)).eq('is_super_admin', false)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

/**
 * Single-employee lookup for the drill-down detail page — visible to the
 * broader manager tier (accounting_manager/ceo/admin), not just ceo/admin
 * like the full roster page. Managers without roster access still reach
 * this via a direct link (e.g. from Reports).
 */
export async function getEmployeeSummary(id: string) {
  await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { data: e, error } = await admin
    .from('employees')
    .select('id, employee_number, name, email, employee_type, department, job_title, hire_date, is_active, avatar_url, leave_balances(pto_hours, sick_hours, personal_hours)')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  const { tier, ptoRate } = calcTier(e.hire_date)
  const bal = Array.isArray(e.leave_balances) ? e.leave_balances[0] : e.leave_balances
  return {
    ...e,
    tier,
    accrual: ptoRate,
    pto_bal: bal ? Number(bal.pto_hours) : 0,
    sick_bal: bal ? Number(bal.sick_hours) : 0,
    personal_bal: bal ? Number(bal.personal_hours) : 0,
  }
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
