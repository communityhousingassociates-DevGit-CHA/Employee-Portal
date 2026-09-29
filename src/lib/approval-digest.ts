// Weekday manager summary: every leave request still waiting for review, expenses/timesheets waiting past the reminder threshold, and
// invites that were sent but never completed. Slow approvals are what let balances and timesheets drift out of date, so this keeps the
// queue honest. Not a
// 'use server' file — it runs from the cron only.

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadPolicy } from '@/lib/policy-server'
import { APPROVER_ROLES, canSelfApprove } from '@/lib/constants/approvals'
import { getApprovers, notify } from '@/lib/notifications'
import { todayET } from '@/lib/pay-periods'
import { getTestAccountIds } from '@/lib/test-accounts'
import { getAuthUserInfo } from '@/lib/auth-users'
import { inviteExpired, inviteExpiresAt } from '@/lib/constants/invites'
import { fmtDate, fmtDateRange } from '@/lib/format-date'

const NOBODY = '00000000-0000-0000-0000-000000000000'

type Item = { employeeId: string; name: string; ageDays: number }

const nameOf = (v: unknown) => (Array.isArray(v) ? v[0]?.name : (v as { name?: string } | null)?.name) ?? 'Someone'
const ageDays = (iso: string, now: number) => Math.floor((now - new Date(iso).getTime()) / 86400000)

export async function sendApprovalDigest(admin: SupabaseClient): Promise<{ sent: number; skipped?: string }> {
  // Weekdays only — nobody wants a Saturday reminder.
  const dow = new Date(`${todayET()}T12:00:00Z`).getUTCDay()
  if (dow === 0 || dow === 6) return { sent: 0, skipped: 'weekend' }

  const REMINDER_AFTER_DAYS = (await loadPolicy(admin)).approval_reminder_days
  const now = Date.now()
  const cutoff = new Date(now - REMINDER_AFTER_DAYS * 86400000).toISOString()

  const [leave, expenses, sheets, allLeave] = await Promise.all([
    admin.from('leave_requests').select('employee_id, created_at, employee:employees!leave_requests_employee_id_fkey(name)').eq('status', 'pending').lt('created_at', cutoff),
    admin.from('expenses').select('employee_id, created_at, employee:employees!expenses_employee_id_fkey(name)').eq('status', 'pending').lt('created_at', cutoff),
    admin.from('timesheets').select('employee_id, employee_signed_at, employee:employees!timesheets_employee_id_fkey(name)').eq('status', 'submitted').lt('employee_signed_at', cutoff),
    // Every pending leave request, of any age — the manager summary lists them all so nothing is forgotten.
    admin.from('leave_requests').select('employee_id, leave_type, start_date, end_date, hours, created_at, employee:employees!leave_requests_employee_id_fkey(name)').eq('status', 'pending').order('created_at'),
  ])
  for (const r of [leave, expenses, sheets, allLeave]) if (r.error) throw new Error(r.error.message)

  // Test accounts (workflow testing) never trigger reminders to the real approvers.
  const testIds = await getTestAccountIds(admin)

  const toItems = (rows: { employee_id: string; employee: unknown; [k: string]: unknown }[] | null, key: string): Item[] =>
    (rows ?? []).filter(r => !testIds.has(r.employee_id)).map(r => ({ employeeId: r.employee_id, name: nameOf(r.employee), ageDays: ageDays(r[key] as string, now) }))
  // Expenses and timesheets are only nudged once they pass the reminder threshold.
  const groups = [
    { label: 'Expenses', items: toItems(expenses.data as never, 'created_at') },
    { label: 'Timesheets', items: toItems(sheets.data as never, 'employee_signed_at') },
  ]
  const leaveItems = (allLeave.data ?? [])
    .filter((r: any) => !testIds.has(r.employee_id))
    .map((r: any) => ({ employeeId: r.employee_id as string, ageDays: ageDays(r.created_at, now), line: `${nameOf(r.employee)} — ${r.leave_type} ${fmtDateRange(r.start_date, r.end_date)}, ${r.hours} hrs (${ageDays(r.created_at, now) === 0 ? 'submitted today' : `${ageDays(r.created_at, now)} day${ageDays(r.created_at, now) === 1 ? '' : 's'} waiting`})` }))

  // Invites sent but not completed — real, active staff who were invited and have not set a password.
  const [{ data: staff }, authInfo] = await Promise.all([
    admin.from('employees').select('id, name, user_id, login_count').eq('is_active', true).eq('is_test_account', false).not('user_id', 'is', null),
    getAuthUserInfo(admin),
  ])
  const pendingInvites = (staff ?? [])
    .filter(e => { const info = authInfo.get(e.user_id as string); return !!info && !info.passwordSet && (e.login_count ?? 0) === 0 })
    .map(e => ({ name: e.name as string, sentAt: authInfo.get(e.user_id as string)?.invitedAt ?? null }))
    .sort((a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''))
  const inviteLines = pendingInvites.map(i => i.sentAt
    ? `${i.name} — sent ${fmtDate(i.sentAt)} (${ageDays(i.sentAt, now) === 0 ? 'today' : `${ageDays(i.sentAt, now)} day${ageDays(i.sentAt, now) === 1 ? '' : 's'} ago`})${inviteExpired(i.sentAt, now) ? ' — link expired, resend needed' : ` — link valid until ${fmtDate(inviteExpiresAt(i.sentAt).toISOString())}`}`
    : `${i.name} — invite date unknown`)

  if (leaveItems.length === 0 && groups.every(g => g.items.length === 0) && inviteLines.length === 0) return { sent: 0 }

  // Managers who approve, plus super admins (who are the ones able to resend invites).
  const approvers = await getApprovers(admin, NOBODY, APPROVER_ROLES)
  const { data: supers } = await admin.from('employees').select('id, email, name, role').eq('is_super_admin', true).eq('is_active', true)
  const recipients = [...approvers, ...((supers ?? []) as typeof approvers).filter(sa => !approvers.some(a => a.id === sa.id))]

  let sent = 0
  for (const person of recipients) {
    const canApprove = APPROVER_ROLES.includes(person.role as never)
    const sections: string[] = []
    let leaveCount = 0
    if (canApprove) {
      // Your own items only count if you're allowed to approve them yourself.
      const mineLeave = leaveItems.filter(i => canSelfApprove(person.role ?? 'employee') || i.employeeId !== person.id)
      leaveCount = mineLeave.length
      if (mineLeave.length > 0) sections.push(`Leave requests to review (${mineLeave.length}):\n${mineLeave.map(i => `  • ${i.line}`).join('\n')}`)
      const other: string[] = []
      for (const g of groups) {
        const mine = g.items.filter(i => canSelfApprove(person.role ?? 'employee') || i.employeeId !== person.id)
        if (mine.length === 0) continue
        const oldest = mine.reduce((a, b) => (b.ageDays > a.ageDays ? b : a))
        other.push(`  • ${g.label}: ${mine.length} waiting more than ${REMINDER_AFTER_DAYS} days (oldest: ${oldest.name}, ${oldest.ageDays} days)`)
      }
      if (other.length) sections.push(`Also waiting:\n${other.join('\n')}`)
    }
    if (inviteLines.length > 0) sections.push(`Invites sent but not completed (${inviteLines.length}):\n${inviteLines.map(l => `  • ${l}`).join('\n')}`)
    if (sections.length === 0) continue
    const parts = [leaveCount > 0 ? `${leaveCount} leave request${leaveCount === 1 ? '' : 's'} to review` : '', inviteLines.length > 0 ? `${inviteLines.length} invite${inviteLines.length === 1 ? '' : 's'} not completed` : ''].filter(Boolean)
    await notify(admin, [person], {
      kind: 'approval_needed',
      title: parts.length ? `Manager summary: ${parts.join(' · ')}` : 'Manager summary: items waiting on you',
      body: sections.join('\n\n'),
      link: canApprove ? '/approvals' : '/admin/users',
      cta: canApprove ? 'Review in Portal' : 'Open User Management',
    })
    sent++
  }
  return { sent }
}
