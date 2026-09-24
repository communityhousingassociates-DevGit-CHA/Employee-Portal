// Payroll-sensitive access (CHA policy, 2026-09-25): salary amounts and the Timesheet Reports view are limited to
// Nico Sanders (President/CEO), Carrileen Edwards (Accounting Manager), and the system super admin (JRio) —
// deliberately narrower than the admin/CEO/accounting roles, so any other admin can't see pay or team timesheets.
// Keyed by portal email, plus anyone carrying the is_super_admin flag. To change who has access, edit this list.
// Regular employees always keep access to their own timesheets, history, and gross wages (handled elsewhere).
export const PAYROLL_ACCESS_EMAILS: string[] = [
  'cedwards@communityhousingmd.org',
  'nsanders@communityhousingmd.org',
  'johnnyrio22@gmail.com',
]

type Accessor = { email: string; is_super_admin?: boolean } | null | undefined

export function hasPayrollAccess(employee: Accessor): boolean {
  return !!employee && (employee.is_super_admin === true || PAYROLL_ACCESS_EMAILS.includes(employee.email.toLowerCase()))
}

/** May see and change salary amounts (one click at a time — see MaskedAmount). */
export const canViewSalaries = hasPayrollAccess

/** May open the Reports → Timesheets view and other people's timesheets. Everyone else sees only their own. */
export const canViewTimesheetReports = hasPayrollAccess
