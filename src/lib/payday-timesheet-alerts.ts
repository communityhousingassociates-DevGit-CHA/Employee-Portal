// Payday timesheet alerts. On a pay date, anyone whose timesheet for the period being paid is still not submitted is emailed
// individually, and a summary goes to Carrileen with Nico copied. Runs from the daily cron (a no-op on any day that isn't a pay date).
//
// "Not submitted" = no timesheet row for the period, or one still in draft (a timesheet sent back for correction returns to draft).
// Test accounts, inactive staff, and anyone who started after / left before the period are left out. Idempotent: email_log records
// each send, so a cron retry or a manual re-run the same day never double-sends. Not a 'use server' file — cron only.

import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { logEmails, type EmailLogEntry } from '@/lib/notifications'
import { PORTAL_REPLY_TO } from '@/lib/constants/email'
import { PAYDAY_REPORT_TO, PAYDAY_REPORT_CC } from '@/lib/constants/approvals'
import { getPayDate, getTimesheetDueDate, todayET, type PayPeriod } from '@/lib/pay-periods'
import { fmtDate, fmtDateRange } from '@/lib/format-date'

const FROM = 'CHA Employee Portal <portal@communityhousingassociates.org>'
const KIND_INDIVIDUAL = 'payday_timesheet_alert'
const KIND_SUMMARY = 'payday_timesheet_summary'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.communityhousingassociates.org').replace(/\/$/, '')

export type PaydaySummary = { ran: boolean; reason?: string; period?: PayPeriod; missing?: string[]; alerted?: string[]; summarySent?: boolean; failed?: { name: string; error: string }[] }

/** The pay period whose pay date is `date`, or null if `date` isn't a pay date. Pay date = period end + 17 days; periods are 14 days. */
export function periodPaidOn(date: string): PayPeriod | null {
  const end = new Date(`${date}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 17)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 13)
  const period = { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  return getPayDate(period) === date && isPeriodStart(period.start) ? period : null
}

function isPeriodStart(start: string): boolean {
  const days = Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse('2026-09-13T00:00:00Z')) / 86400000)
  return days >= 0 && days % 14 === 0
}

function individualEmail(firstName: string, period: PayPeriod, due: string, link: string) {
  return `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#0b2b35;padding:16px 20px;border-radius:12px 12px 0 0"><span style="color:#fff;font-size:15px;font-weight:700">CHA Employee Portal</span></div>
      <div style="border:1px solid #d4eef2;border-top:none;border-radius:0 0 12px 12px;padding:22px;color:#0b2b35">
        <p style="font-size:14px;margin:0 0 12px">Hi ${esc(firstName || 'there')},</p>
        <p style="font-size:16px;font-weight:700;margin:0 0 10px;color:#d97706">Your timesheet hasn&rsquo;t been submitted</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 14px;color:#374151">Today is payday for the pay period <strong>${esc(fmtDateRange(period.start, period.end))}</strong>, and the portal shows your timesheet for that period has not been submitted. It was due ${esc(fmtDate(due))}.</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 18px;color:#374151">Please open it, check your hours, and submit it as soon as you can so it can be approved and paid.</p>
        <p style="margin:0 0 18px"><a href="${link}" style="background:#02ACC0;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 26px;border-radius:8px;display:inline-block">Open my timesheet</a></p>
        <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0">Already submitted it, or think this is a mistake? Reply to this email and CHA will sort it out.</p>
      </div>
    </div>`
}

function summaryEmail(period: PayPeriod, due: string, missing: { name: string; status: string }[], alerted: Set<string>, link: string) {
  const rows = missing.map(m => `
        <tr><td style="padding:6px 8px;border-bottom:1px solid #f0f7f8"><strong>${esc(m.name)}</strong></td><td style="padding:6px 8px;border-bottom:1px solid #f0f7f8;color:#6b7280">${esc(m.status)}</td><td style="padding:6px 8px;border-bottom:1px solid #f0f7f8;text-align:right;color:${alerted.has(m.name) ? '#059669' : '#dc2626'}">${alerted.has(m.name) ? 'Alert sent' : 'Alert NOT sent'}</td></tr>`).join('')
  return `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto">
      <div style="background:#0b2b35;padding:16px 20px;border-radius:12px 12px 0 0"><span style="color:#fff;font-size:15px;font-weight:700">CHA Employee Portal &mdash; payday timesheet report</span></div>
      <div style="border:1px solid #d4eef2;border-top:none;border-radius:0 0 12px 12px;padding:20px;color:#0b2b35">
        <p style="font-size:14px;line-height:1.6;margin:0 0 12px">Today (${esc(fmtDate(getPayDate(period)))}) is payday for <strong>${esc(fmtDateRange(period.start, period.end))}</strong>. Timesheets were due ${esc(fmtDate(due))}. <strong>${missing.length} timesheet${missing.length === 1 ? ' is' : 's are'} still not submitted:</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>
        <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:14px 0 0">Each person above was emailed an individual reminder. A timesheet that is not submitted can&rsquo;t be approved, so payroll will not include these hours until it is. An admin can complete one on a person&rsquo;s behalf from the Approvals area.</p>
        <p style="margin:18px 0 0"><a href="${link}" style="background:#02ACC0;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 18px;border-radius:8px;display:inline-block">Open Approvals</a></p>
      </div>
    </div>`
}

export async function sendPaydayTimesheetAlerts(admin: SupabaseClient, now: Date = new Date()): Promise<PaydaySummary> {
  const today = todayET(now)
  const period = periodPaidOn(today)
  if (!period) return { ran: false, reason: 'not a pay date' }
  if (!process.env.RESEND_API_KEY) return { ran: false, period, reason: 'RESEND_API_KEY not set' }
  const due = getTimesheetDueDate(period)

  const [{ data: staff, error: e1 }, { data: sheets, error: e2 }] = await Promise.all([
    admin.from('employees').select('id, name, first_name, email, hire_date, end_date').eq('is_active', true).eq('is_test_account', false).order('name'),
    admin.from('timesheets').select('employee_id, status').eq('period_start', period.start),
  ])
  if (e1 || e2) throw new Error((e1 ?? e2)!.message)
  const statusOf = new Map((sheets ?? []).map(s => [s.employee_id as string, s.status as string]))

  const missing = (staff ?? [])
    .filter(e => e.hire_date <= period.end && (!e.end_date || e.end_date >= period.start))
    .filter(e => { const s = statusOf.get(e.id as string); return !s || s === 'draft' })
    .map(e => ({ id: e.id as string, name: e.name as string, first: (e.first_name ?? '') as string, email: e.email as string, status: statusOf.has(e.id as string) ? 'In draft — not submitted' : 'Not started' }))
  if (missing.length === 0) return { ran: true, period, missing: [], alerted: [] }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const subjectOf = (kind: string) => kind === KIND_INDIVIDUAL
    ? `[CHA Portal] Payday: your timesheet for ${fmtDateRange(period.start, period.end)} hasn't been submitted`
    : `[CHA Portal] Payday report: ${missing.length} timesheet${missing.length === 1 ? '' : 's'} not submitted — ${fmtDateRange(period.start, period.end)}`

  // Already sent for this period today? (email_log is the record — reruns skip anyone already alerted.)
  const { data: prior } = await admin.from('email_log').select('recipient_email, kind, subject').in('kind', [KIND_INDIVIDUAL, KIND_SUMMARY]).eq('status', 'sent').gte('created_at', `${today}T00:00:00-05:00`)
  const sentBefore = (kind: string, to: string) => (prior ?? []).some(p => p.kind === kind && p.recipient_email.toLowerCase() === to.toLowerCase() && p.subject === subjectOf(kind))

  const out: PaydaySummary = { ran: true, period, missing: missing.map(m => m.name), alerted: [], failed: [] }
  const alerted = new Set<string>()
  const log: EmailLogEntry[] = []

  for (const m of missing) {
    if (sentBefore(KIND_INDIVIDUAL, m.email)) { alerted.add(m.name); continue }
    const subject = subjectOf(KIND_INDIVIDUAL)
    try {
      const r = await resend.emails.send({ from: FROM, replyTo: PORTAL_REPLY_TO, to: m.email, subject, html: individualEmail(m.first || m.name.split(' ')[0], period, due, `${siteUrl()}/timesheet`) })
      log.push({ source: 'notification', kind: KIND_INDIVIDUAL, recipient_email: m.email, subject, status: r.error ? 'failed' : 'sent', error: r.error?.message ?? null, resend_id: r.data?.id ?? null })
      if (r.error) throw new Error(r.error.message)
      alerted.add(m.name); out.alerted!.push(m.name)
    } catch (e) {
      out.failed!.push({ name: m.name, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // Summary: Carrileen (to) with Nico (cc), one message so the thread is shared.
  const subject = subjectOf(KIND_SUMMARY)
  if (!PAYDAY_REPORT_TO.every(to => sentBefore(KIND_SUMMARY, to))) {
    try {
      const r = await resend.emails.send({ from: FROM, replyTo: PORTAL_REPLY_TO, to: PAYDAY_REPORT_TO, cc: PAYDAY_REPORT_CC, subject, html: summaryEmail(period, due, missing, alerted, `${siteUrl()}/approvals`) })
      for (const to of [...PAYDAY_REPORT_TO, ...PAYDAY_REPORT_CC]) log.push({ source: 'notification', kind: KIND_SUMMARY, recipient_email: to, subject, status: r.error ? 'failed' : 'sent', error: r.error?.message ?? null, resend_id: r.data?.id ?? null })
      out.summarySent = !r.error
      if (r.error) out.failed!.push({ name: 'Summary report', error: r.error.message })
    } catch (e) {
      out.failed!.push({ name: 'Summary report', error: e instanceof Error ? e.message : String(e) })
    }
  }
  await logEmails(admin, log)
  return out
}
