import { UserError } from '@/lib/user-error'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { FINAL_APPROVER_ROLES, isTestApprover } from '@/lib/constants/approvals'
import { todayET } from '@/lib/pay-periods'
import { notifyEmployee } from '@/lib/notifications'
import type { Employee } from '@/types'

type Admin = ReturnType<typeof createAdminClient>

/** Who may make the FINAL approve/deny decision (see constants/approvals.ts): the CEO, or someone the CEO has named as backup for today. */
export type DecisionAuthority = {
  actor: Employee
  /** True when the actor is deciding under a delegation rather than as the CEO. */
  viaDelegation: boolean
  /** The CEO whose authority is being used (set when viaDelegation). */
  delegatorId: string | null
  delegatorName: string | null
  /** True for the test approver / super admin: decides test items, and real ones only as an authorized emergency override. */
  override: boolean
}

/** The delegation that is in force today for this employee as backup, if any. */
export async function getActiveDelegationFor(admin: Admin, employeeId: string) {
  const today = todayET()
  const { data } = await admin
    .from('approval_delegations')
    .select('id, delegator_id, delegate_id, starts_on, ends_on, delegator:employees!approval_delegations_delegator_id_fkey(name, role, is_active)')
    .eq('delegate_id', employeeId)
    .is('revoked_at', null)
    .lte('starts_on', today)
    .gte('ends_on', today)
  const row = (data ?? []).find(d => {
    const who = d.delegator as unknown as { role: string; is_active: boolean } | { role: string; is_active: boolean }[] | null
    const w = Array.isArray(who) ? who[0] : who
    return !!w && w.is_active && (FINAL_APPROVER_ROLES as string[]).includes(w.role)
  })
  if (!row) return null
  const who = row.delegator as unknown as { name: string } | { name: string }[] | null
  return { id: row.id as string, delegatorId: row.delegator_id as string, delegatorName: (Array.isArray(who) ? who[0]?.name : who?.name) ?? 'the CEO' }
}

/** Resolves the signed-in employee's final-decision authority, or null if they have none today. */
export async function getDecisionAuthority(): Promise<DecisionAuthority | null> {
  const actor = await getCurrentEmployee()
  if (!actor) return null
  if (FINAL_APPROVER_ROLES.includes(actor.role)) return { actor, viaDelegation: false, delegatorId: null, delegatorName: null, override: false }
  if (isTestApprover(actor)) return { actor, viaDelegation: false, delegatorId: null, delegatorName: null, override: true }
  const delegation = await getActiveDelegationFor(createAdminClient(), actor.id)
  if (!delegation) return null
  return { actor, viaDelegation: true, delegatorId: delegation.delegatorId, delegatorName: delegation.delegatorName, override: false }
}

/** For Server Actions that approve or deny. Throws unless the caller is the CEO or his backup for today. */
export async function requireDecisionAuthority(): Promise<DecisionAuthority> {
  const authority = await getDecisionAuthority()
  if (!authority) throw new UserError('Final approval belongs to the CEO. Ask him to approve this, or to name you as backup while he is away.')
  return authority
}

/**
 * Checks the item itself. Nobody but the CEO may decide an item that is theirs or that they completed on the
 * employee's behalf, and a backup may never decide the CEO's own items. Throws with a message for the UI.
 */
export async function assertMayDecide(admin: Admin, authority: DecisionAuthority, item: { employee_id: string; submitted_by?: string | null }, noun: string): Promise<boolean> {
  const { actor, viaDelegation, delegatorId, override } = authority
  // Test items and real items never mix: the test approver decides only test-account items, everyone else only real ones.
  const { data: owner } = await admin.from('employees').select('is_test_account').eq('id', item.employee_id).maybeSingle()
  const isTestItem = !!owner?.is_test_account
  if (!override && isTestItem) throw new UserError(`This ${noun} belongs to a test account — only the test approver decides it.`)
  // The test approver may decide test items freely (his own and on-behalf ones included). On a REAL item it is an emergency
  // override: allowed, but the caller reports it to the CEO. Returns true when that is the case.
  if (override) return !isTestItem
  if (item.employee_id === actor.id && viaDelegation) throw new UserError(`You can't decide your own ${noun} — only the CEO can approve it.`)
  if (item.submitted_by === actor.id && viaDelegation) throw new UserError(`You completed this ${noun} on the employee's behalf, so the CEO needs to decide it.`)
  if (viaDelegation && item.employee_id === delegatorId) throw new UserError(`A backup approver can't decide the CEO's own ${noun} — only he can approve it.`)
  return false
}

/** Column value to stamp on a decided row so the audit trail shows delegated authority. */
export function delegatedFrom(authority: DecisionAuthority): string | null {
  return authority.viaDelegation ? authority.delegatorId : null
}

/** Suffix for the employee-facing decision text: backup or emergency-override attribution, else "". */
export function onBehalfSuffix(authority: DecisionAuthority, overrideUsed = false): string {
  if (overrideUsed) return ' (system override, authorized by CHA)'
  return authority.viaDelegation && authority.delegatorName ? ` (as backup for ${authority.delegatorName})` : ''
}

/**
 * Reports to the CEO (bell + email) a decision made under someone else's authority: a backup's decision, or an emergency override
 * on a real item (`overrideUsed`). No-op for ordinary decisions. Never throws.
 */
export async function announceDelegatedDecision(admin: Admin, authority: DecisionAuthority, what: string, overrideUsed = false) {
  let ceoId = authority.viaDelegation ? authority.delegatorId : null
  if (overrideUsed) {
    const { data: ceo } = await admin.from('employees').select('id').in('role', FINAL_APPROVER_ROLES).eq('is_active', true).eq('is_test_account', false).limit(1).maybeSingle()
    ceoId = (ceo?.id as string | undefined) ?? null
  }
  if (!ceoId) return
  await notifyEmployee(admin, ceoId, {
    kind: 'approved',
    title: overrideUsed ? `System override used by ${authority.actor.name}` : `${authority.actor.name} decided something as your backup`,
    body: `${what}\n${overrideUsed ? `Decided by ${authority.actor.name} under the system emergency override.` : `Decided by ${authority.actor.name} under your backup-approver delegation.`}`,
    link: '/approvals',
    cta: 'Open Approvals',
  })
}
