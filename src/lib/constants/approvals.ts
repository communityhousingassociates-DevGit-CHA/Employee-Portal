import type { Role } from '@/types'

// Who may approve what. Policy (CHA, 2026-09-24): the President/CEO is the sole approver for
// leave requests and expenses — including his own. Timesheets are reviewed by any manager-tier
// role, but never by their own author. Change these lists to change policy.
export const LEAVE_EXPENSE_APPROVER_ROLES: Role[] = ['ceo']
export const TIMESHEET_APPROVER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']
