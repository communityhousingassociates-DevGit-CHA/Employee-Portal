import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getPendingLeaveApprovals, getReviewedLeaveApprovals, getCancelledLeaveRequests } from '@/app/actions/leave-requests'
import { getPendingExpenseApprovals } from '@/app/actions/expenses'
import { getPendingTimesheetApprovals, getApprovedTimesheets } from '@/app/actions/timesheets'
import { getTagList } from '@/app/actions/tags'
import ApprovalsClient from '@/components/ApprovalsClient'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

export default async function ApprovalsPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !MANAGER_ROLES.includes(employee.role)) redirect('/dashboard')

  const [pendingLeave, reviewedLeave, cancelledLeave, pendingExpenses, pendingTimesheets, approvedTimesheets, customTags] = await Promise.all([
    getPendingLeaveApprovals(),
    getReviewedLeaveApprovals(),
    getCancelledLeaveRequests(),
    getPendingExpenseApprovals(),
    getPendingTimesheetApprovals(),
    getApprovedTimesheets(),
    getTagList(),
  ])

  return (
    <ApprovalsClient
      approverName={employee.name}
      initialPendingLeave={pendingLeave}
      initialReviewedLeave={reviewedLeave}
      initialCancelledLeave={cancelledLeave}
      initialPendingExpenses={pendingExpenses}
      initialPendingTimesheets={pendingTimesheets}
      initialApprovedTimesheets={approvedTimesheets}
      viewerRole={employee.role}
      customTags={customTags}
    />
  )
}
