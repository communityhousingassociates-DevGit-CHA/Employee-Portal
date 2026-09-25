// Daily reminder for approvers: one message listing everything that has been waiting longer than REMINDER_AFTER_DAYS.
// Slow approvals are what let balances and timesheets drift out of date, so this keeps the queue honest. Not a
// 'use server' file — it runs from the cron only.

import type { SupabaseClient } from '@supabase/supabase-js'
import { APPROVER_ROLES, REMINDER_AFTER_DAYS, canSelfApprove } from '@/lib/constants/approvals'
import { getApprovers, notify } from '@/lib/notifications'
import { todayET } from '@/lib/pay-periods'

const NOBODY = '00000000-0000-0000-0000-000000000000'

type Item = { employeeId: string; name: string; ageDays: number }

const nameOf = (v: unknown) => (Array.isArray(v) ? v[0]?.name : (v as { name?: string } | null)?.name) ?? 'Someone'
const ageDays = (iso: string, now: number) => Math.floor((now - new Date(iso).getTime()) / 86400000)

export async function sendApprovalDigest(admin: SupabaseClient): Promise<{ sent: number; skipped?: string }> {
  // Weekdays only — nobody wants a Saturday reminder.
  const dow = new Date(`${todayET()}T12:00:00Z`).getUTCDay()
  if (dow === 0 || dow === 6) return { sent: 0, skipped: 'weekend' }

  const now = Date.now()
  const cutoff = new Date(now - REMINDER_AFTER_DAYS * 86400000).toISOString()

  const [leave, expenses, sheets] = await Promise.all([
    admin.from('leave_requests').select('employee_id, created_at, employee:employees!leave_requests_employee_id_fkey(name)').eq('status', 'pending').lt('created_at', cutoff),
    admin.from('expenses').select('employee_id, created_at, employee:employees!expenses_employee_id_fkey(name)').eq('status', 'pending').lt('created_at', cutoff),
    admin.from('timesheets').select('employee_id, employee_signed_at, employee:employees!timesheets_employee_id_fkey(name)').eq('status', 'submitted').lt('employee_signed_at', cutoff),
  ])
  for (const r of [leave, expenses, sheets]) if (r.error) throw new Error(r.error.message)

  const toItems = (rows: { employee_id: string; employee: unknown; [k: string]: unknown }[] | null, key: string): Item[] =>
    (rows ?? []).map(r => ({ employeeId: r.employee_id, name: nameOf(r.employee), ageDays: ageDays(r[key] as string, now) }))
  const groups = [
    { label: 'Leave requests', items: toItems(leave.data as never, 'created_at') },
    { label: 'Expenses', items: toItems(expenses.data as never, 'created_at') },
    { label: 'Timesheets', items: toItems(sheets.data as never, 'employee_signed_at') },
  ]
  if (groups.every(g => g.items.length === 0)) return { sent: 0 }

  const approvers = await getApprovers(admin, NOBODY, APPROVER_ROLES)
  let sent = 0
  for (const approver of approvers) {
    const lines: string[] = []
    let total = 0
    for (const g of groups) {
      // Your own items only count if you're allowed to approve them yourself.
      const mine = g.items.filter(i => canSelfApprove(approver.role ?? 'employee') || i.employeeId !== approver.id)
      if (mine.length === 0) continue
      const oldest = mine.reduce((a, b) => (b.ageDays > a.ageDays ? b : a))
      total += mine.length
      lines.push(`${g.label}: ${mine.length} waiting (oldest: ${oldest.name}, ${oldest.ageDays} days)`)
    }
    if (total === 0) continue
    await notify(admin, [approver], {
      kind: 'approval_needed',
      title: `${total} approval${total === 1 ? '' : 's'} waiting more than ${REMINDER_AFTER_DAYS} days`,
      body: lines.join('\n'),
      link: '/approvals',
      cta: 'Review in Portal',
    })
    sent++
  }
  return { sent }
}
