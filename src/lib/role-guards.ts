// Who may manage whose account. ADMIN_ROLES (admin, ceo) can both open the admin console, but that must not let a plain admin
// reach the people above them: the CEO is the only final approver, payroll access is keyed by email, and super admins sit above
// everyone. Without these rules an admin could reset the CEO's password, change the CEO's (or a payroll user's) email, or give
// themselves the 'ceo' role. Pure functions so they can be unit-tested; employees.ts applies them to every account action.

import { PAYROLL_ACCESS_EMAILS } from '@/lib/constants/salary-access'
import type { Role } from '@/types'

export const ALL_ROLES: Role[] = ['employee', 'accounting_manager', 'ceo', 'admin']
/** Roles that confer powers over other people; only the CEO or a super admin may grant or remove them. */
const PRIVILEGED_ROLES: Role[] = ['ceo', 'admin']

export type Actor = { id: string; role: Role; is_super_admin?: boolean | null }
export type Target = { id: string; role: Role | string; email?: string | null; is_super_admin?: boolean | null }

const isSuper = (a: { is_super_admin?: boolean | null }) => a.is_super_admin === true
export const hasPayrollEmail = (email?: string | null) => !!email && PAYROLL_ACCESS_EMAILS.includes(email.toLowerCase())

/** A target whose account carries standing power: CEO/admin role, or payroll access. Only the CEO (or a super admin) may manage them. */
function isPrivilegedTarget(t: Target): boolean {
  return PRIVILEGED_ROLES.includes(t.role as Role) || hasPayrollEmail(t.email)
}

/** May `actor` edit, archive, delete, reset the password of, or otherwise manage `target`'s account? */
export function canManageAccount(actor: Actor, target: Target): boolean {
  if (isSuper(target)) return isSuper(actor) // a super admin is managed only by a super admin
  if (isSuper(actor)) return true
  if (isPrivilegedTarget(target)) return actor.role === 'ceo'
  return true
}

/** Returns why `actor` may not give `target` the role `newRole`, or null if they may. */
export function roleChangeProblem(actor: Actor, target: Target, newRole: string): string | null {
  if (!ALL_ROLES.includes(newRole as Role)) return 'That is not a valid role.'
  if (newRole === target.role) return null
  if (isSuper(target) && !isSuper(actor)) return 'Only a super admin can change a super admin’s role.'
  if (isSuper(actor)) return null
  if (actor.id === target.id) return 'You cannot change your own role.'
  if ((PRIVILEGED_ROLES.includes(newRole as Role) || PRIVILEGED_ROLES.includes(target.role as Role)) && actor.role !== 'ceo') {
    return 'Only the CEO can grant or remove admin or CEO access.'
  }
  return null
}

/** Returns why `actor` may not set `target`'s email to `newEmail`, or null. Payroll access follows email, so those are guarded. */
export function emailChangeProblem(actor: Actor, target: Target, newEmail: string): string | null {
  const current = (target.email ?? '').toLowerCase()
  const next = newEmail.trim().toLowerCase()
  if (current === next) return null
  if (isSuper(actor)) return null
  if (hasPayrollEmail(current) || hasPayrollEmail(next)) return 'Only a super admin can change an email that carries payroll access.'
  return null
}
