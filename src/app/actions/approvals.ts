'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { APPROVER_ROLES, canSelfApprove } from '@/lib/constants/approvals'
import { getTestAccountIds } from '@/lib/test-accounts'

/**
 * How many leave requests, expenses and timesheets are waiting on the signed-in approver — the sidebar's Approvals badge.
 * Applies the same filters as the three pending queues (own items only if self-approval is allowed; test-account
 * submissions hidden from real approvers), so the badge always matches what the Approvals page lists. 0 for non-approvers.
 */
export async function getPendingApprovalCount(): Promise<number> {
  const actor = await getCurrentEmployee()
  if (!actor || !APPROVER_ROLES.includes(actor.role)) return 0
  const admin = createAdminClient()
  const testIds = actor.is_test_account ? new Set<string>() : await getTestAccountIds(admin)

  async function count(table: 'leave_requests' | 'expenses' | 'timesheets', status: string) {
    let query = admin.from(table).select('id', { count: 'exact', head: true }).eq('status', status)
    if (!canSelfApprove(actor!.role)) {
      query = query.neq('employee_id', actor!.id)
      // …nor anything you completed on someone's behalf (leave, timesheets and expenses all record who submitted).
      query = query.or(`submitted_by.is.null,submitted_by.neq.${actor!.id}`)
    }
    if (testIds.size) query = query.not('employee_id', 'in', `(${[...testIds].join(',')})`)
    const { count: n, error } = await query
    if (error) throw new Error(error.message)
    return n ?? 0
  }

  const [leave, expenses, timesheets] = await Promise.all([count('leave_requests', 'pending'), count('expenses', 'pending'), count('timesheets', 'submitted')])
  return leave + expenses + timesheets
}
