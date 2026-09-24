import type { Role } from '@/types'

// Who may approve what. Policy (CHA, 2026-09-24): the President/CEO is the sole approver for
// leave requests and expenses — including his own. Timesheets are reviewed by any manager-tier
// role, but never by their own author. Change these lists to change policy.
export const LEAVE_EXPENSE_APPROVER_ROLES: Role[] = ['ceo']
export const TIMESHEET_APPROVER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

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
