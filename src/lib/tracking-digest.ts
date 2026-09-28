// Daily tracking digest for CHA (TRACKING_DIGEST_TO): what was submitted in the last 24 hours and what is still waiting on approval.
// It is a record-keeping email — it takes no action and never goes to employees. Test accounts are left out. Not a 'use server' file: it
// runs from the daily cron only.

import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { TRACKING_DIGEST_TO, TRACKING_DIGEST_INCLUDE_ACTIVITY } from '@/lib/constants/approvals'
import { logEmails } from '@/lib/notifications'
import { getTestAccountIds } from '@/lib/test-accounts'
import { todayET } from '@/lib/pay-periods'
import { fmtDate, fmtDateRange } from '@/lib/format-date'

const FROM = 'CHA Employee Portal <portal@communityhousingassociates.org>'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const nameOf = (v: unknown) => (Array.isArray(v) ? v[0]?.name : (v as { name?: string } | null)?.name) ?? 'Someone'
const ageDays = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000))
const money = (n: unknown) => `$${Number(n).toFixed(2)}`

type Row = { who: string; what: string; status: string }

/** `issues` = problems the daily job hit (failed accrual rows, year-end errors, ...). Emails that failed to send in the last 24h are added here too. */
export async function sendTrackingDigest(admin: SupabaseClient, issues: string[] = [], now: Date = new Date()): Promise<{ sent: boolean; reason?: string }> {
  if (TRACKING_DIGEST_TO.length === 0) return { sent: false, reason: 'no recipients configured' }
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: 'RESEND_API_KEY not set' }
  const since = new Date(now.getTime() - 24 * 3600000).toISOString()
  const testIds = await getTestAccountIds(admin)
  const real = <T extends { employee_id: string }>(rows: T[] | null) => (rows ?? []).filter(r => !testIds.has(r.employee_id))

  const { data: failedEmails } = await admin.from('email_log').select('recipient_email, subject, error').eq('status', 'failed').gte('created_at', since)
  const problems = [
    ...issues,
    ...(failedEmails ?? []).map(e => `Email to ${e.recipient_email} failed (“${e.subject}”): ${e.error ?? 'unknown error'}`),
  ]

  const [leaveNew, expNew, sheetNew, leaveWait, expWait, sheetWait] = await Promise.all([
    admin.from('leave_requests').select('employee_id, leave_type, start_date, end_date, hours, status, created_at, employee:employees!leave_requests_employee_id_fkey(name)').gte('created_at', since).order('created_at'),
    admin.from('expenses').select('employee_id, category, amount, expense_date, status, created_at, employee:employees!expenses_employee_id_fkey(name)').gte('created_at', since).order('created_at'),
    admin.from('timesheets').select('employee_id, period_start, period_end, status, employee_signed_at, employee:employees!timesheets_employee_id_fkey(name)').gte('employee_signed_at', since).order('employee_signed_at'),
    admin.from('leave_requests').select('employee_id, leave_type, start_date, end_date, hours, created_at, employee:employees!leave_requests_employee_id_fkey(name)').eq('status', 'pending').order('created_at'),
    admin.from('expenses').select('employee_id, category, amount, created_at, employee:employees!expenses_employee_id_fkey(name)').eq('status', 'pending').order('created_at'),
    admin.from('timesheets').select('employee_id, period_start, period_end, employee_signed_at, employee:employees!timesheets_employee_id_fkey(name)').eq('status', 'submitted').order('employee_signed_at'),
  ])
  for (const r of [leaveNew, expNew, sheetNew, leaveWait, expWait, sheetWait]) if (r.error) throw new Error(r.error.message)

  const submitted: { label: string; rows: Row[] }[] = [
    { label: 'Leave requests', rows: real(leaveNew.data as never).map((r: any) => ({ who: nameOf(r.employee), what: `${r.leave_type} · ${fmtDateRange(r.start_date, r.end_date)} · ${r.hours} hrs`, status: r.status })) },
    { label: 'Expenses', rows: real(expNew.data as never).map((r: any) => ({ who: nameOf(r.employee), what: `${String(r.category).replace(/_/g, ' ')} · ${money(r.amount)} · ${fmtDate(r.expense_date)}`, status: r.status })) },
    { label: 'Timesheets', rows: real(sheetNew.data as never).map((r: any) => ({ who: nameOf(r.employee), what: `Pay period ${fmtDateRange(r.period_start, r.period_end)}`, status: r.status })) },
  ]
  const t = now.getTime()
  const waiting: { label: string; rows: Row[] }[] = [
    { label: 'Leave requests', rows: real(leaveWait.data as never).map((r: any) => ({ who: nameOf(r.employee), what: `${r.leave_type} · ${fmtDateRange(r.start_date, r.end_date)} · ${r.hours} hrs`, status: `${ageDays(r.created_at, t)} day(s) waiting` })) },
    { label: 'Expenses', rows: real(expWait.data as never).map((r: any) => ({ who: nameOf(r.employee), what: `${String(r.category).replace(/_/g, ' ')} · ${money(r.amount)}`, status: `${ageDays(r.created_at, t)} day(s) waiting` })) },
    { label: 'Timesheets', rows: real(sheetWait.data as never).map((r: any) => ({ who: nameOf(r.employee), what: `Pay period ${fmtDateRange(r.period_start, r.period_end)}`, status: `${ageDays(r.employee_signed_at, t)} day(s) waiting` })) },
  ]
  const nSubmitted = submitted.reduce((s, g) => s + g.rows.length, 0)
  const nWaiting = waiting.reduce((s, g) => s + g.rows.length, 0)
  const showActivity = TRACKING_DIGEST_INCLUDE_ACTIVITY && (nSubmitted > 0 || nWaiting > 0)
  if (!showActivity && problems.length === 0) return { sent: false, reason: TRACKING_DIGEST_INCLUDE_ACTIVITY ? 'nothing to report' : 'no problems to report' }

  const section = (title: string, groups: { label: string; rows: Row[] }[], empty: string) => {
    const body = groups.filter(g => g.rows.length).map(g => `
      <p style="font-size:13px;font-weight:700;margin:14px 0 6px">${g.label} (${g.rows.length})</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">${g.rows.map(r => `
        <tr><td style="padding:5px 8px;border-bottom:1px solid #f0f7f8;width:28%"><strong>${esc(r.who)}</strong></td><td style="padding:5px 8px;border-bottom:1px solid #f0f7f8">${esc(r.what)}</td><td style="padding:5px 8px;border-bottom:1px solid #f0f7f8;text-align:right;text-transform:capitalize;color:#6b7280">${esc(r.status)}</td></tr>`).join('')}
      </table>`).join('')
    return `<h3 style="font-size:14px;margin:22px 0 4px;color:#0b2b35">${title}</h3>${body || `<p style="font-size:12px;color:#9ca3af;margin:6px 0">${empty}</p>`}`
  }
  const today = fmtDate(todayET(now))
  const subject = showActivity
    ? `${problems.length ? `⚠ ${problems.length} issue${problems.length === 1 ? '' : 's'} · ` : ''}[CHA Portal] Daily activity — ${today}: ${nSubmitted} submitted, ${nWaiting} waiting`
    : `⚠ [CHA Portal] ${problems.length} issue${problems.length === 1 ? '' : 's'} need attention — ${today}`
  const issuesHtml = problems.length
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin:14px 0 0;font-size:12px;color:#991b1b"><strong>Needs attention (${problems.length})</strong><ul style="margin:6px 0 0;padding-left:18px">${problems.slice(0, 20).map(p => `<li>${esc(p)}</li>`).join('')}</ul>${problems.length > 20 ? `<p style="margin:6px 0 0">…and ${problems.length - 20} more.</p>` : ''}</div>`
    : ''
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto">
      <div style="background:#0b2b35;padding:16px 20px;border-radius:12px 12px 0 0"><span style="color:#fff;font-size:15px;font-weight:700">CHA Employee Portal — daily activity</span></div>
      <div style="border:1px solid #d4eef2;border-top:none;border-radius:0 0 12px 12px;padding:20px;color:#0b2b35">
        <p style="font-size:12px;color:#6b7280;margin:0">${showActivity ? `For your records. Submitted in the last 24 hours, and everything still waiting on approval as of ${esc(today)}. Approvals are done in the portal.` : 'The portal hit a problem that may need someone to look at it.'}</p>
        ${issuesHtml}
        ${showActivity ? section('Submitted in the last 24 hours', submitted, 'Nothing was submitted.') + section('Still waiting on approval', waiting, 'Nothing is waiting.') : ''}
      </div>
    </div>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const results = await Promise.allSettled(TRACKING_DIGEST_TO.map(to => resend.emails.send({ from: FROM, to, subject, html })))
  await logEmails(admin, results.map((res, i) => {
    const base = { source: 'notification' as const, kind: 'tracking_digest', recipient_email: TRACKING_DIGEST_TO[i], subject }
    if (res.status === 'rejected') return { ...base, status: 'failed' as const, error: String(res.reason instanceof Error ? res.reason.message : res.reason) }
    if (res.value.error) return { ...base, status: 'failed' as const, error: res.value.error.message }
    return { ...base, status: 'sent' as const, resend_id: res.value.data?.id ?? null }
  }))
  return { sent: results.some(r => r.status === 'fulfilled' && !r.value.error) }
}
