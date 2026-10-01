import { hasPayrollAccess } from '@/lib/constants/salary-access'

// Completing a leave request or timesheet FOR another employee is an exception to the employee submitting it themselves,
// so it always carries a reason code and notes and is logged (see migration 036).
//
// WHO may do it (CHA policy, 2026-09-30): only Nico Sanders (President/CEO), Carrileen Edwards (Accounting Manager) and the
// system super admin — the same named people as payroll access, deliberately narrower than the admin/CEO/accounting roles.
// It reuses that list (PAYROLL_ACCESS_EMAILS in salary-access.ts), so one edit changes both. Split it out if they ever need to differ.
export const canActOnBehalf = hasPayrollAccess

export const ON_BEHALF_REASONS = [
  { code: 'employee_request', label: 'Employee asked me to (phone, email or in person)' },
  { code: 'no_access', label: 'Employee can’t access the portal yet (account not set up)' },
  { code: 'employee_unavailable', label: 'Employee is out or unavailable (illness, travel, emergency)' },
  { code: 'deadline', label: 'Pay-period deadline reached and the employee hasn’t submitted' },
  { code: 'correction', label: 'Correcting or completing an entry for the employee' },
  { code: 'other', label: 'Other (explain in the notes)' },
] as const

export type OnBehalfReasonCode = (typeof ON_BEHALF_REASONS)[number]['code']

export const ON_BEHALF_NOTE_MIN_LENGTH = 10

export function onBehalfReasonLabel(code: string | null | undefined): string {
  return ON_BEHALF_REASONS.find(r => r.code === code)?.label ?? code ?? ''
}

/** What the admin sends with every on-behalf action. */
export type OnBehalf = { reasonCode: string; note: string }

/** Why an on-behalf justification isn't acceptable yet (null = fine). Used by the forms and by the server. */
export function onBehalfProblem(v: { reasonCode: string; note: string }): string | null {
  if (!ON_BEHALF_REASONS.some(r => r.code === v.reasonCode)) return 'Choose a reason for completing this on the employee’s behalf.'
  if (v.note.trim().length < ON_BEHALF_NOTE_MIN_LENGTH) return `Add notes (at least ${ON_BEHALF_NOTE_MIN_LENGTH} characters) explaining why you are completing this for the employee.`
  return null
}

/** The wording the admin agrees to when signing as the preparer. Stored verbatim on the audit event. */
export function onBehalfAttestation(employeeName: string): string {
  return `I am completing this on behalf of ${employeeName} as an exception to the employee submitting it directly. I have recorded the reason, and I confirm the information is accurate to the best of my knowledge. The employee has not signed this entry themselves.`
}
