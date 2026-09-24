import type { LeaveType, Role } from '@/types'

// Who may approve what (CHA policy, updated 2026-09-24). Leave requests, expenses, and timesheets are
// all reviewed by the Accounting Manager / CEO / Admin roles (Carrileen Edwards holds `admin`, Nico
// Sanders `ceo`). Change these lists to change policy.
export const APPROVER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']
export const LEAVE_EXPENSE_APPROVER_ROLES: Role[] = APPROVER_ROLES
export const TIMESHEET_APPROVER_ROLES: Role[] = APPROVER_ROLES

// Leave types that need no approver, as long as the employee's balance covers the request (CHA policy,
// 2026-09-24). They are approved automatically at submission — balance deducted, days posted to the
// timesheet. A request that exceeds the balance falls back to normal approval. Everything else
// (PTO, Vacation, Jury Duty, Bereavement) waits for an approver.
export const AUTO_APPROVED_LEAVE_TYPES: LeaveType[] = ['Sick']

// Self-approval: after beta only the CEO may approve his own items; anyone else's own items route to
// another approver (for the Accounting Manager, that means the CEO). While `betaOverride` is true,
// every approver may approve their own items so Nico and Carrileen can test the full flow alone.
// Set betaOverride to false when beta ends.
export const SELF_APPROVAL: { betaOverride: boolean; rolesAfterBeta: Role[] } = {
  betaOverride: true,
  rolesAfterBeta: ['ceo'],
}

export function canSelfApprove(role: Role): boolean {
  return SELF_APPROVAL.betaOverride || SELF_APPROVAL.rolesAfterBeta.includes(role)
}

// Notification TEST MODE (set 2026-09-24). While `enabled`:
//   * approver-alert emails (new leave request / expense / timesheet) go ONLY to `emailRecipients`
//     instead of the real approvers, and are labelled as test alerts saying who they'd normally reach;
//   * no notification email is ever sent to someone holding a role in `neverEmailRoles` (the CEO).
// In-portal notifications (the bell) are unaffected. Flip `enabled` to false to go live.
export const NOTIFICATION_TEST_MODE: { enabled: boolean; emailRecipients: string[]; neverEmailRoles: Role[] } = {
  enabled: true,
  emailRecipients: ['cedwards@communityhousingmd.org', 'advisor@globalist.pro'],
  neverEmailRoles: ['ceo'],
}
