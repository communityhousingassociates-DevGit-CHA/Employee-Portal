import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAccruals } from '@/lib/accruals'
import { runYearEndCarryover } from '@/lib/carryover'
import { runPersonalDaysGrant } from '@/lib/personal-grants'
import { applyDueLeaveDeductions } from '@/lib/leave-deductions'
import { populateDraftTimesheets } from '@/lib/leave-timesheet'
import { sendApprovalDigest } from '@/lib/approval-digest'
import { sendTrackingDigest } from '@/lib/tracking-digest'
import { sendInviteReminders } from '@/lib/invite-reminders'

// Daily job (vercel.json), in two steps:
//  0. Year-end carryover — in January only (from the 2027 year-end on), trims each employee's combined annual + personal +
//     sick balance to their tenure limit. Runs first so the new year's accruals aren't counted against last year's limit.
//  0b. Personal Days grant — January 1: +24 hrs for every full-time employee, after the carryover trim.
//  1. Accruals — does nothing until switched on under Admin Console → Leave Balances, which records the first pay
//     period the portal should accrue. Each run credits any period from then through today that hasn't been
//     credited yet (accrual_log makes it idempotent), so a missed day never skips a period.
//  2. Leave deductions — approved leave that was reserved while it was in the future comes off the balance once
//     its start date arrives. Runs regardless of the accrual switch, after accruals so a shortfall isn't overstated.
//  5. Invite reminders — staff who were invited but never set a password get a reminder with a fresh link each day (max 7).
//  4. Tracking digest — a daily record for CHA (TRACKING_DIGEST_TO) of what was submitted and what is still waiting.
//  3. Approver digest — a weekday reminder of anything that's been waiting on approval longer than REMINDER_AFTER_DAYS.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const carryover = await runYearEndCarryover(admin).catch(e => ({ ran: false, error: e instanceof Error ? e.message : String(e) }))

  const personalGrant = await runPersonalDaysGrant(admin).catch(e => ({ ran: false, error: e instanceof Error ? e.message : String(e) }))

  const { data: settings, error } = await admin.from('accrual_settings').select('enabled, first_period_start').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const accruals = settings?.enabled && settings.first_period_start
    ? { ran: true, ...(await runAccruals(admin, settings.first_period_start)) }
    : { ran: false, reason: 'accruals are not switched on' }

  const deductions = await applyDueLeaveDeductions(admin).catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
  // Timesheet days fill in as their date arrives (nothing is pre-populated for the future).
  const timesheetFill = await populateDraftTimesheets(admin).catch(e => ({ timesheets: 0, error: e instanceof Error ? e.message : String(e) }))
  const digest = await sendApprovalDigest(admin).catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
  const inviteReminders = await sendInviteReminders(admin).catch(e => ({ reminded: [] as string[], failed: [{ name: 'Invite reminders', error: e instanceof Error ? e.message : String(e) }], skipped: 0 }))
  // Anything the daily job hit that needs a person to look at it goes into the tracking digest's "Needs attention" box.
  const issues: string[] = []
  const errs = (label: string, r: unknown) => {
    const e = (r as { errors?: string[]; error?: string; reason?: string; shortfalls?: number }) ?? {}
    for (const m of e.errors ?? []) issues.push(`${label}: ${m}`)
    if (e.error) issues.push(`${label}: ${e.error}`)
  }
  errs('Year-end carryover', carryover); errs('Personal Days grant', personalGrant); errs('Accruals', accruals); errs('Leave deductions', deductions); errs('Approver reminders', digest); errs('Timesheet fill', timesheetFill)
  // Sign-ins the location rule refused in the last 24 hours (someone traveling, a VPN, or a real attempt) — worth a look.
  const { data: blocks } = await admin.from('geofence_blocks').select('employee_id, region, country, city, employee:employees(name)').gte('created_at', new Date(Date.now() - 86400000).toISOString())
  const byPerson = new Map<string, { name: string; where: string; n: number }>()
  for (const b of (blocks ?? []) as unknown as { employee_id: string; region: string | null; country: string | null; city: string | null; employee: { name: string } | { name: string }[] | null }[]) {
    const nm = (Array.isArray(b.employee) ? b.employee[0]?.name : b.employee?.name) ?? 'Someone'
    const cur = byPerson.get(b.employee_id) ?? { name: nm, where: [b.city, b.region, b.country].filter(Boolean).join(', ') || 'unknown location', n: 0 }
    cur.n++; byPerson.set(b.employee_id, cur)
  }
  for (const v of byPerson.values()) issues.push(`Sign-in blocked by the location rule: ${v.name} (${v.n} attempt${v.n === 1 ? '' : 's'}, from ${v.where}). If this is legitimate travel, grant travel access in User Management.`)
  for (const f of inviteReminders.failed) issues.push(`Invite reminder for ${f.name}: ${f.error}`)
  if ((deductions as { shortfalls?: number }).shortfalls) issues.push(`${(deductions as { shortfalls?: number }).shortfalls} approved leave request(s) came due with an insufficient balance — see the notices to approvers.`)
  const tracking = await sendTrackingDigest(admin, issues).catch(e => ({ sent: false, reason: e instanceof Error ? e.message : String(e) }))
  return NextResponse.json({ inviteReminders, tracking, carryover, personalGrant, accruals, deductions, timesheetFill, digest })
}
