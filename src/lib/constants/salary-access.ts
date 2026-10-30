// Payroll-sensitive access (CHA policy, 2026-09-25): salary amounts and the Timesheet Reports view are limited to
// Nico Sanders (President/CEO), Carrileen Edwards (Accounting Manager), and the system super admin (JRio) —
// deliberately narrower than the admin/CEO/accounting roles, so any other admin can't see pay or team timesheets.
// Held as a flag on the employee (employees.has_payroll_access, changed by a super admin in User Management and audited), plus anyone
// carrying is_super_admin. PAYROLL_ACCESS_EMAILS below is only the fallback for a database that predates migration 045.
// Regular employees always keep access to their own timesheets, history, and gross wages (handled elsewhere).
/** @deprecated Fallback only, used while employees.has_payroll_access does not exist yet. Delete once migration 045 is applied everywhere. */
export const PAYROLL_ACCESS_EMAILS: string[] = [
  'cedwards@communityhousingmd.org',
  'nsanders@communityhousingmd.org',
  'johnnyrio22@gmail.com',
]

type Accessor = { email: string; is_super_admin?: boolean | null; has_payroll_access?: boolean | null } | null | undefined

export function hasPayrollAccess(employee: Accessor): boolean {
  if (!employee) return false
  if (employee.is_super_admin === true) return true
  // Column present (true or false): it alone decides. Column absent (undefined): the pre-migration email list.
  if (employee.has_payroll_access !== undefined && employee.has_payroll_access !== null) return employee.has_payroll_access === true
  return PAYROLL_ACCESS_EMAILS.includes(employee.email.toLowerCase())
}

/** May see and change salary amounts (one click at a time — see MaskedAmount). */
export const canViewSalaries = hasPayrollAccess

/** May open the Reports → Timesheets view and other people's timesheets. Everyone else sees only their own. */
export const canViewTimesheetReports = hasPayrollAccess
