import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getPendingLeaveApprovals, getReviewedLeaveApprovals, getCancelledLeaveRequests } from '@/app/actions/leave-requests'
import { getPendingExpenseApprovals } from '@/app/actions/expenses'
import { getPendingTimesheetApprovals, getApprovedTimesheets } from '@/app/actions/timesheets'
import { getTagList } from '@/app/actions/tags'
import ApprovalsClient from '@/components/ApprovalsClient'
import BackupApproverCard from '@/components/BackupApproverCard'
import { getDecisionAuthority } from '@/lib/approval-authority'
import { getBackupApproverState } from '@/app/actions/delegation'
import { FINAL_APPROVER_ROLES } from '@/lib/constants/approvals'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

export default async function ApprovalsPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !MANAGER_ROLES.includes(employee.role)) redirect('/dashboard')

  const authority = await getDecisionAuthority()
  const backupState = FINAL_APPROVER_ROLES.includes(employee.role) ? await getBackupApproverState() : null
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
    <>
    {backupState && <BackupApproverCard {...backupState} />}
    <ApprovalsClient
      canDecide={!!authority}
      backupFor={authority?.viaDelegation ? authority.delegatorName : null}
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
    </>
  )
}
