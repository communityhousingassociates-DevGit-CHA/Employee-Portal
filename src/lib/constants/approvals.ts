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
// (PTO, Personal Days, Jury Duty, Bereavement, …) waits for an approver. Sick leave may be future-dated (a planned
// appointment); if it starts beyond the two-pay-period window it is auto-approved but only reserved, like PTO.
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

// Notification TEST MODE. Switched OFF 2026-09-25 — real submissions now alert the real approvers (Carrileen, Nico) by
// email and in the portal. Flip `enabled` back to true to route every approver alert to `emailRecipients` instead.
//
// Independent of `enabled`: anything submitted by a test account (employees.is_test_account, e.g. "Test User") is ALWAYS
// alerted to `emailRecipients` only — bell and email — and left out of the approver digest, so workflow testing never
// reaches real approvers. While `enabled`:
//   * approver-alert emails (new leave request / expense / timesheet) go ONLY to `emailRecipients`
//     instead of the real approvers, and are labelled as test alerts saying who they'd normally reach;
//   * no notification email is ever sent to someone holding a role in `neverEmailRoles` (the CEO).
// In-portal notifications (the bell) are unaffected. Flip `enabled` to false to go live.
export const NOTIFICATION_TEST_MODE: { enabled: boolean; emailRecipients: string[]; neverEmailRoles: Role[] } = {
  enabled: false,
  // Who receives alerts for test-account submissions (and for everything when `enabled`).
  emailRecipients: ['johnnyrio22@gmail.com'],
  neverEmailRoles: ['ceo'],
}

// Every LIVE "approval needed" alert (leave, expense and timesheet submissions) is also emailed, as its own message, to these
// addresses so CHA keeps a record of what Carrileen and Nico were told. Not sent in test mode, and never for test-account submissions.
export const APPROVER_ALERT_COPY_TO: string[] = ['communityhousingassociates@gmail.com']

// The daily email to TRACKING_DIGEST_TO. Per-alert copies (above) already record every request, so by default the daily email is only
// sent when something went wrong ("Needs attention"). Set to true to also include the daily list of submissions and waiting items.
export const TRACKING_DIGEST_INCLUDE_ACTIVITY = false

// A daily digest of everything submitted (leave requests, expenses, timesheets) and everything still waiting on approval is emailed
// here, for CHA's own tracking. Real staff only — test accounts are left out. Sent by the daily cron; nothing is sent on a day with
// nothing to report.
export const TRACKING_DIGEST_TO: string[] = ['communityhousingassociates@gmail.com']

// Closing a date range for accounting (see closed_periods). Lifting a closure is restricted to the CEO override role.
export const CLOSE_PERIOD_ROLES: Role[] = APPROVER_ROLES

// Approvers get a daily digest (weekdays) of anything that has been waiting on them longer than this many days.
export const REMINDER_AFTER_DAYS = 2
