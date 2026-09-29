'use server'

import { ADMIN_ROLES } from '@/lib/constants/admin-access'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { calcTier } from '@/lib/constants/accrual'
import { loadPolicy } from '@/lib/policy-server'
import { getAuthUserInfo } from '@/lib/auth-users'
import { inviteExpired } from '@/lib/constants/invites'
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
  end_date?: string
  grant_id: string | null
  pto_uncapped?: boolean
  is_exempt?: boolean
  is_director?: boolean
  is_active?: boolean
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
}) {
  await requireRole(ADMIN_ROLES)
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
    end_date: data.end_date || null,
    grant_id: data.grant_id,
    pto_uncapped: data.pto_uncapped ?? false,
    is_exempt: data.is_exempt ?? true,
    is_director: data.is_director ?? false,
    address_line1: data.address_line1 || null,
    address_line2: data.address_line2 || null,
    city: data.city || null,
    state: data.state || null,
    postal_code: data.postal_code || null,
    is_active: data.is_active ?? true,
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
  end_date?: string
  grant_id: string | null
  pto_uncapped?: boolean
  is_exempt?: boolean
  is_director?: boolean
  is_active?: boolean
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
}) {
  const me = await requireRole(ADMIN_ROLES)
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
    end_date: data.end_date || null,
    grant_id: data.grant_id,
    pto_uncapped: data.pto_uncapped ?? false,
    is_exempt: data.is_exempt ?? true,
    is_director: data.is_director ?? false,
    // Status is configurable here, but an admin can never deactivate their own account (mirrors setEmployeesActive)
    ...(data.is_active !== undefined && id !== me.id ? { is_active: data.is_active } : {}),
    address_line1: data.address_line1 || null,
    address_line2: data.address_line2 || null,
    city: data.city || null,
    state: data.state || null,
    postal_code: data.postal_code || null,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function archiveEmployee(id: string) {
  await requireRole(ADMIN_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_active: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function restoreEmployee(id: string) {
  await requireRole(ADMIN_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_active: true }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export async function deleteEmployee(id: string) {
  await requireRole(ADMIN_ROLES)
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
  await requireRole(ADMIN_ROLES)
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
  await requireRole(ADMIN_ROLES)
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

export async function getEmployees() {
  const actor = await requireRole(ADMIN_ROLES)
  const admin = createAdminClient()
  const policy = await loadPolicy(admin)
  let query = admin
    .from('employees')
    .select('id, employee_number, first_name, last_name, middle_initial, name, email, role, employee_type, staff_category, department, job_title, hire_date, end_date, avatar_url, is_active, is_test_account, is_super_admin, pto_uncapped, is_exempt, is_director, year_end_holiday, login_geofence_regions, geofence_override_until, address_line1, address_line2, city, state, postal_code, user_id, grant_id, grant:grants(name), login_count')
    .order('name')
  // Test accounts (workflow testing) are only visible to the super admin who uses them — invisible to every other admin, including other 'admin'-role staff.
  if (!actor.is_super_admin) query = query.eq('is_test_account', false)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const authInfo = await getAuthUserInfo(admin)
  return (data ?? []).map(e => {
    const { tier, ptoRate } = calcTier(e.hire_date, Date.now(), policy)
    const grant = Array.isArray(e.grant) ? e.grant[0] : e.grant
    // Active = set a password through the portal (flag), or has signed in with one before (login_count covers accounts created earlier).
    const info = e.user_id ? authInfo.get(e.user_id) : undefined
    const invite_status: InviteStatus = !e.user_id ? 'not_invited' : (info?.passwordSet || (e.login_count ?? 0) > 0) ? 'active' : 'invited'
    const invite_sent_at = e.user_id ? info?.invitedAt ?? null : null
    const invite_expired = invite_status === 'invited' && !!invite_sent_at && inviteExpired(invite_sent_at)
    const status = e.is_test_account ? 'test' : e.is_active ? 'active' : 'archived'
    return { ...e, tier, accrual: ptoRate, status, grant_name: grant?.name ?? null, invite_status, invite_sent_at, invite_expired }
  })
}

/** Roles that may grant or clear travel access (temporary sign-in from outside the allowed states). */
const TRAVEL_ACCESS_ROLES = ['admin', 'ceo', 'accounting_manager'] as const

/** Lets someone sign in from anywhere for `days` days (a business trip, a phone on an odd carrier). 0 clears it. Records who granted it. */
export async function setGeofenceOverride(id: string, days: number) {
  const me = await requireRole([...TRAVEL_ACCESS_ROLES])
  if (!Number.isFinite(days) || days < 0 || days > 30) throw new Error('Choose between 0 and 30 days.')
  const admin = createAdminClient()
  const { data: target, error: readError } = await admin.from('employees').select('login_geofence_regions').eq('id', id).single()
  if (readError) throw new Error(readError.message)
  if ((target.login_geofence_regions as string[] | null)?.includes('*')) throw new Error('This account is already allowed from anywhere.')
  const until = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
  const { error } = await admin.from('employees').update({ geofence_override_until: until, geofence_override_by: days > 0 ? me.id : null }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
  revalidatePath('/admin/settings')
}

/** Staff the location rule applies to, with any travel access currently granted. */
export async function getTravelAccessList() {
  await requireRole([...TRAVEL_ACCESS_ROLES])
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, name, job_title, geofence_override_until, login_geofence_regions, granter:employees!employees_geofence_override_by_fkey(name)')
    .eq('is_active', true).eq('is_test_account', false).order('name')
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter(e => !(e.login_geofence_regions as string[] | null)?.includes('*'))
    .map(e => {
      const g = e.granter as unknown as { name: string } | { name: string }[] | null
      const until = e.geofence_override_until as string | null
      return { id: e.id as string, name: e.name as string, job_title: (e.job_title as string | null) ?? null, override_until: until && Date.parse(until) > Date.now() ? until : null, granted_by: (Array.isArray(g) ? g[0]?.name : g?.name) ?? null }
    })
}

/** Super admin only — flips an employee's test-account flag. Test accounts are hidden from every other admin, the shared calendar, the directory, and real approvers' queues; used for workflow testing without touching real staff data. */
export async function setEmployeeTestAccount(id: string, isTest: boolean) {
  await requireSuperAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_test_account: isTest }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

/**
 * Sends portal invite emails to employees who haven't signed in yet —
 * first-time invites for people never invited, and re-sends for people whose
 * invite went unused (expired, lost, or filtered as spam). Super admin only,
 * same as the post-import invite step, since these are real emails.
 *
 * Re-sending: Supabase refuses to invite an email that already has an auth
 * user, so an invited-but-never-signed-in account is replaced with a fresh
 * one. That's only done after confirming the person has never set a password
 * (no password_set_at flag and no portal logins) — an account that has been used is never touched.
 */
export async function sendInvites(
  employeeIds: string[]
): Promise<{ invited: string[]; failed: { email: string; error: string }[]; skipped: string[] }> {
  await requireSuperAdmin()
  const admin = createAdminClient()
  const { data: employees, error } = await admin
    .from('employees')
    .select('id, email, first_name, user_id, is_active, login_count')
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
      const setUp = !!(existing.user?.user_metadata as { password_set_at?: string } | null)?.password_set_at || (emp.login_count ?? 0) > 0
      if (setUp) { skipped.push(emp.email); continue } // already using the portal

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
  const me = await requireRole(ADMIN_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ is_active: active }).in('id', ids.filter(id => id !== me.id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

/** Bulk delete. Never applies to the caller's own row or to any super admin. */
export async function deleteEmployees(ids: string[]) {
  const me = await requireRole(ADMIN_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('employees').delete().in('id', ids.filter(id => id !== me.id)).eq('is_super_admin', false)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

export type BulkEditableField = 'role' | 'employee_type' | 'staff_category' | 'department' | 'grant_id' | 'end_date' | 'is_active'
const BULK_EDITABLE_FIELDS: BulkEditableField[] = ['role', 'employee_type', 'staff_category', 'department', 'grant_id', 'end_date', 'is_active']

/**
 * True bulk field edit — sets one field to one value across every selected
 * employee, distinct from the existing bulk archive/restore/delete actions
 * (which only ever touch is_active or delete the row). Never applies to the
 * caller's own row, same as the other bulk actions. `value: null` clears the
 * field (e.g. unassign a grant, remove an end date) — meaningful for every
 * field here except role/employee_type/staff_category, where the UI always
 * supplies one of their fixed options.
 */
export async function bulkEditEmployees(ids: string[], field: BulkEditableField, value: string | null) {
  if (!BULK_EDITABLE_FIELDS.includes(field)) throw new Error('Not a bulk-editable field')
  const me = await requireRole(ADMIN_ROLES)
  const admin = createAdminClient()
  const targetIds = ids.filter(id => id !== me.id)
  if (targetIds.length === 0) return
  if (field === 'is_active' && value !== 'true' && value !== 'false') throw new Error('Status must be active or inactive')
  const normalized = field === 'is_active' ? value === 'true' : field === 'employee_type' && value ? value.toLowerCase() : value
  const { error } = await admin.from('employees').update({ [field]: normalized }).in('id', targetIds)
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
  const policy = await loadPolicy(admin)
  const { data: e, error } = await admin
    .from('employees')
    .select('id, employee_number, name, email, employee_type, department, job_title, hire_date, is_active, avatar_url, pto_uncapped, is_exempt, is_director, year_end_holiday, leave_balances(pto_hours, sick_hours, personal_hours, flex_hours)')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  const { tier, ptoRate } = calcTier(e.hire_date, Date.now(), policy)
  const bal = Array.isArray(e.leave_balances) ? e.leave_balances[0] : e.leave_balances
  return {
    ...e,
    tier,
    accrual: ptoRate,
    pto_bal: bal ? Number(bal.pto_hours) : 0,
    sick_bal: bal ? Number(bal.sick_hours) : 0,
    personal_bal: bal ? Number(bal.personal_hours) : 0,
    flex_bal: bal ? Number(bal.flex_hours ?? 0) : 0,
  }
}

/** Read-only staff directory for the (portal) Employees page — visible to ceo/admin. Test accounts never appear here, regardless of who's viewing. */
export async function getEmployeeDirectory() {
  await requireRole(['ceo', 'admin'])
  const admin = createAdminClient()
  const policy = await loadPolicy(admin)
  const { data, error } = await admin
    .from('employees')
    .select('id, employee_number, first_name, last_name, middle_initial, name, email, employee_type, department, job_title, hire_date, is_active, pto_uncapped, leave_balances(pto_hours, sick_hours, personal_hours)')
    .eq('is_test_account', false)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(e => {
    const { tier, ptoRate } = calcTier(e.hire_date, Date.now(), policy)
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
