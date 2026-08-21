import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Employee, Role } from '@/types'

/**
 * Resolves the current signed-in employee row, or null if unauthenticated,
 * not mapped to an employees row, or deactivated.
 *
 * Uses the admin (service-role) client because `employees` has RLS enabled
 * with no policies defined — the anon client silently returns nothing
 * against it today.
 */
export async function getCurrentEmployee(): Promise<Employee | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: employee } = await admin
    .from('employees')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!employee || !employee.is_active) return null
  return employee as Employee
}

/**
 * For use inside Server Actions. Throws if the current user isn't signed in
 * or doesn't hold one of the allowed roles. Do not use inside Server
 * Components — use getCurrentEmployee() + redirect() there instead.
 */
export async function requireRole(allowed: Role[]): Promise<Employee> {
  const employee = await getCurrentEmployee()
  if (!employee || !allowed.includes(employee.role)) {
    throw new Error('Forbidden')
  }
  return employee
}

/**
 * For use inside Server Actions. Throws unless the current user IS
 * targetEmployeeId, or holds one of the allowed roles — for data (like
 * salary) that an employee should be able to view about themself, but
 * only manager-tier roles should view for others.
 */
export async function requireSelfOrRole(targetEmployeeId: string, allowed: Role[]): Promise<Employee> {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  if (employee.id === targetEmployeeId || allowed.includes(employee.role)) return employee
  throw new Error('Forbidden')
}

/**
 * For use inside Server Actions. Throws unless the current user carries the
 * is_super_admin flag — a narrower gate than role: 'admin'. Maker-checker:
 * an admin can prepare a data import (parse/preview) but only a super admin
 * can actually commit it or send real invite emails.
 */
export async function requireSuperAdmin(): Promise<Employee> {
  const employee = await getCurrentEmployee()
  if (!employee || !employee.is_super_admin) throw new Error('Forbidden')
  return employee
}
