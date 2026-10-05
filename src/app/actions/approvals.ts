'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getDecisionAuthority } from '@/lib/approval-authority'
import { canSelfApprove } from '@/lib/constants/approvals'
import { getTestAccountIds } from '@/lib/test-accounts'

/**
 * How many leave requests, expenses and timesheets are waiting on the signed-in approver — the sidebar's Approvals badge.
 * Applies the same filters as the three pending queues (own items only if self-approval is allowed; test-account
 * submissions hidden from real approvers), so the badge always matches what the Approvals page lists. 0 for non-approvers.
 */
export async function getPendingApprovalCount(): Promise<number> {
  // Only people who can actually make the final decision (the CEO, or his backup today) have anything "waiting on them".
  const authority = await getDecisionAuthority()
  if (!authority) return 0
  const actor = authority.actor
  const admin = createAdminClient()
  const testIds = await getTestAccountIds(admin)

  async function count(table: 'leave_requests' | 'expenses' | 'timesheets', status: string) {
    let query = admin.from(table).select('id', { count: 'exact', head: true }).eq('status', status)
    if (!canSelfApprove(actor!)) {
      query = query.neq('employee_id', actor!.id)
      // …nor anything you completed on someone's behalf (leave, timesheets and expenses all record who submitted).
      query = query.or(`submitted_by.is.null,submitted_by.neq.${actor!.id}`)
    }
    if (authority!.viaDelegation && authority!.delegatorId) query = query.neq('employee_id', authority!.delegatorId) // a backup never decides the CEO's own items
    if (!actor!.is_test_account && testIds.size) query = query.not('employee_id', 'in', `(${[...testIds].join(',')})`)
    const { count: n, error } = await query
    if (error) throw new Error(error.message)
    return n ?? 0
  }

  const [leave, expenses, timesheets] = await Promise.all([count('leave_requests', 'pending'), count('expenses', 'pending'), count('timesheets', 'submitted')])
  return leave + expenses + timesheets
}
