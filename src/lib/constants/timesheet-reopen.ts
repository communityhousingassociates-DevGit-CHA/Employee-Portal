import type { Role } from '@/types'

// Every reopen / return of a timesheet needs one of these codes plus written notes, and is logged.
export const REOPEN_REASON_CODES = [
  { value: 'employee_error', label: 'Employee error (wrong or missing hours)' },
  { value: 'approver_error', label: 'Approver error' },
  { value: 'leave_change', label: 'Leave added or changed' },
  { value: 'payroll_discrepancy', label: 'Payroll / accounting discrepancy' },
  { value: 'post_payroll_adjustment', label: 'Post-payroll adjustment (CEO override)' },
  { value: 'other', label: 'Other (explain in notes)' },
] as const

export type ReopenReasonCode = (typeof REOPEN_REASON_CODES)[number]['value']

export function reopenReasonLabel(code: string | null | undefined): string {
  return REOPEN_REASON_CODES.find(c => c.value === code)?.label ?? 'Other'
}

// After the payroll due date, only these roles may reopen a timesheet (the "CEO override"). Change to change policy.
export const REOPEN_OVERRIDE_ROLES: Role[] = ['ceo']
