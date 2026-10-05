'use server'

import { UserError } from '@/lib/user-error'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { FINAL_APPROVER_ROLES, APPROVER_ROLES } from '@/lib/constants/approvals'
import { notifyEmployee } from '@/lib/notifications'
import { todayET } from '@/lib/pay-periods'
import { fmtDate } from '@/lib/format-date'

export type BackupApprover = { id: string; delegate_id: string; delegate_name: string; starts_on: string; ends_on: string; note: string | null }
export type BackupCandidate = { id: string; name: string }

async function requireFinalApprover() {
  const actor = await getCurrentEmployee()
  if (!actor || !FINAL_APPROVER_ROLES.includes(actor.role)) throw new UserError('Only the CEO can name a backup approver.')
  return actor
}

/** The CEO's current/upcoming backup approvals (not revoked, not yet ended) plus who he could pick. CEO only. */
export async function getBackupApproverState(): Promise<{ backups: BackupApprover[]; candidates: BackupCandidate[]; today: string }> {
  const actor = await requireFinalApprover()
  const admin = createAdminClient()
  const today = todayET()
  const [{ data: rows }, { data: people }] = await Promise.all([
    admin.from('approval_delegations').select('id, delegate_id, starts_on, ends_on, note, delegate:employees!approval_delegations_delegate_id_fkey(name)').eq('delegator_id', actor.id).is('revoked_at', null).gte('ends_on', today).order('starts_on'),
    admin.from('employees').select('id, name').in('role', APPROVER_ROLES).eq('is_active', true).eq('is_test_account', false).neq('id', actor.id).order('name'),
  ])
  const backups = (rows ?? []).map(r => {
    const d = r.delegate as unknown as { name: string } | { name: string }[] | null
    return { id: r.id as string, delegate_id: r.delegate_id as string, delegate_name: (Array.isArray(d) ? d[0]?.name : d?.name) ?? 'Unknown', starts_on: r.starts_on as string, ends_on: r.ends_on as string, note: (r.note as string | null) ?? null }
  })
  return { backups, candidates: (people ?? []) as BackupCandidate[], today }
}

/** Names `delegateId` as backup approver for startsOn–endsOn (inclusive). CEO only; the backup is told by bell + email. */
export async function setBackupApprover(delegateId: string, startsOn: string, endsOn: string, note: string) {
  const actor = await requireFinalApprover()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) throw new UserError('Choose a start and end date.')
  if (endsOn < startsOn) throw new UserError('The end date must be on or after the start date.')
  if (endsOn < todayET()) throw new UserError('That period is already over.')
  const admin = createAdminClient()
  const { data: delegate } = await admin.from('employees').select('id, name, role, is_active, is_test_account').eq('id', delegateId).maybeSingle()
  if (!delegate || !delegate.is_active || delegate.is_test_account || !APPROVER_ROLES.includes(delegate.role) || delegate.id === actor.id) throw new UserError('Choose a manager to act as backup.')

  // One backup per overlapping window keeps "who can decide today" unambiguous for the audit trail.
  const { data: overlap } = await admin.from('approval_delegations').select('id').eq('delegator_id', actor.id).eq('delegate_id', delegateId).is('revoked_at', null).lte('starts_on', endsOn).gte('ends_on', startsOn)
  if (overlap && overlap.length) throw new UserError(`${delegate.name} is already your backup for part of that period — revoke it first.`)

  const { error } = await admin.from('approval_delegations').insert({ delegator_id: actor.id, delegate_id: delegateId, starts_on: startsOn, ends_on: endsOn, note: note.trim() || null })
  if (error) throw new Error(error.message)

  await notifyEmployee(admin, delegateId, {
    kind: 'approved',
    title: `You are ${actor.name}'s backup approver`,
    body: `From ${fmtDate(startsOn)} through ${fmtDate(endsOn)} you can approve and deny leave requests, expenses and timesheets in his place.\nYou still can't decide your own items or his.${note.trim() ? `\nNote: ${note.trim()}` : ''}`,
    link: '/approvals',
    cta: 'Open Approvals',
  })
  revalidatePath('/approvals')
}

/** Ends a backup approval immediately. CEO only. */
export async function revokeBackupApprover(id: string) {
  const actor = await requireFinalApprover()
  const admin = createAdminClient()
  const { data: row } = await admin.from('approval_delegations').select('delegate_id').eq('id', id).eq('delegator_id', actor.id).is('revoked_at', null).maybeSingle()
  if (!row) throw new UserError('That backup approval no longer exists.')
  const { error } = await admin.from('approval_delegations').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  await notifyEmployee(admin, row.delegate_id as string, {
    kind: 'returned',
    title: `Your backup-approver access has ended`,
    body: `${actor.name} ended your backup-approver access. Final approval is his again.`,
    link: '/approvals',
    cta: 'Open Approvals',
  })
  revalidatePath('/approvals')
}
