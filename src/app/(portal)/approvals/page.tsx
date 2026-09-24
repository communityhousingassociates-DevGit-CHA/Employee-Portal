import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getPendingLeaveApprovals, getReviewedLeaveApprovals } from '@/app/actions/leave-requests'
import { getPendingExpenseApprovals } from '@/app/actions/expenses'
import { getPendingTimesheetApprovals } from '@/app/actions/timesheets'
import ApprovalsClient from '@/components/ApprovalsClient'
import { LEAVE_EXPENSE_APPROVER_ROLES } from '@/lib/constants/approvals'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

export default async function ApprovalsPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !MANAGER_ROLES.includes(employee.role)) redirect('/dashboard')

  // Leave requests and expenses are approved by the CEO only; other managers just review timesheets.
  const canApproveLeaveExpenses = LEAVE_EXPENSE_APPROVER_ROLES.includes(employee.role)
  const [pendingLeave, reviewedLeave, pendingExpenses, pendingTimesheets] = await Promise.all([
    canApproveLeaveExpenses ? getPendingLeaveApprovals() : Promise.resolve([]),
    canApproveLeaveExpenses ? getReviewedLeaveApprovals() : Promise.resolve([]),
    canApproveLeaveExpenses ? getPendingExpenseApprovals() : Promise.resolve([]),
    getPendingTimesheetApprovals(),
  ])

  return (
    <ApprovalsClient
      approverName={employee.name}
      canApproveLeaveExpenses={canApproveLeaveExpenses}
      initialPendingLeave={pendingLeave}
      initialReviewedLeave={reviewedLeave}
      initialPendingExpenses={pendingExpenses}
      initialPendingTimesheets={pendingTimesheets}
    />
  )
}
