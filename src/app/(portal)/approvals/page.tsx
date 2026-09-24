import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getPendingLeaveApprovals, getReviewedLeaveApprovals } from '@/app/actions/leave-requests'
import { getPendingExpenseApprovals } from '@/app/actions/expenses'
import { getPendingTimesheetApprovals } from '@/app/actions/timesheets'
import ApprovalsClient from '@/components/ApprovalsClient'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

export default async function ApprovalsPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !MANAGER_ROLES.includes(employee.role)) redirect('/dashboard')

  const [pendingLeave, reviewedLeave, pendingExpenses, pendingTimesheets] = await Promise.all([
    getPendingLeaveApprovals(),
    getReviewedLeaveApprovals(),
    getPendingExpenseApprovals(),
    getPendingTimesheetApprovals(),
  ])

  return (
    <ApprovalsClient
      approverName={employee.name}
      initialPendingLeave={pendingLeave}
      initialReviewedLeave={reviewedLeave}
      initialPendingExpenses={pendingExpenses}
      initialPendingTimesheets={pendingTimesheets}
    />
  )
}
