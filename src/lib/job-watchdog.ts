// Dead-man check for the daily job. The daily cron records a `job_runs` row ('daily-cron') every time it runs, whether or not it found
// problems, so a missing row is the only way to tell it did not run at all (a broken route, a middleware redirect, a lapsed secret).
// This runs from its own cron path a couple of hours later, so it still fires when the main route is what broke. Not a 'use server' file.

import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { WATCHDOG_ALERT_TO, WATCHDOG_MAX_AGE_HOURS } from '@/lib/constants/approvals'
import { PORTAL_REPLY_TO } from '@/lib/constants/email'
import { logEmails } from '@/lib/notifications'
import { recordJobRun } from '@/lib/system-log'

const FROM = 'CHA Employee Portal <portal@communityhousingassociates.org>'
const WATCHED_JOB = 'daily-cron'

/** Why the job counts as missing, or null when it ran recently enough. */
export function staleJobProblem(lastStartedAt: string | null, now: Date, maxAgeHours: number): string | null {
  if (!lastStartedAt) return 'The daily job has no recorded runs at all.'
  const hours = (now.getTime() - new Date(lastStartedAt).getTime()) / 3600000
  if (hours <= maxAgeHours) return null
  return `The daily job last ran ${Math.floor(hours)} hours ago (${lastStartedAt}); it should run every 24 hours.`
}

export async function runWatchdog(admin: SupabaseClient, now: Date = new Date()): Promise<{ ok: boolean; problem: string | null; emailed: boolean }> {
  const { data, error } = await admin.from('job_runs').select('started_at').eq('job', WATCHED_JOB).order('started_at', { ascending: false }).limit(1).maybeSingle()
  // A failed lookup is its own problem: report it instead of assuming the job is fine.
  const problem = error ? `Could not read job_runs: ${error.message}` : staleJobProblem(data?.started_at ?? null, now, WATCHDOG_MAX_AGE_HOURS)

  let emailed = false
  if (problem && WATCHDOG_ALERT_TO.length > 0) {
    const subject = 'CHA portal: the daily job did not run'
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b2b35">
      <div style="background:#0b2b35;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:700">CHA Employee Portal · needs attention</div>
      <div style="border:1px solid #d4eef2;border-top:0;border-radius:0 0 8px 8px;padding:18px;font-size:14px">
        <p style="margin:0 0 10px">${problem.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>
        <p style="margin:0 0 10px">Leave accruals, reserved-leave deductions, reminders and the daily digest depend on it. Check the latest runs under Admin Console → System, the Vercel cron logs for <code>/api/cron/accrual</code>, and that <code>CRON_SECRET</code> is still set in Vercel.</p>
        <p style="margin:0;font-size:11px;color:#9ca3af">Sent by the portal watchdog (/api/cron/watchdog).</p>
      </div></div>`
    const resend = new Resend(process.env.RESEND_API_KEY)
    const results = await Promise.allSettled(WATCHDOG_ALERT_TO.map(to => resend.emails.send({ from: FROM, replyTo: PORTAL_REPLY_TO, to, subject, html })))
    await logEmails(admin, results.map((res, i) => {
      const base = { source: 'notification' as const, kind: 'watchdog', recipient_email: WATCHDOG_ALERT_TO[i], subject }
      if (res.status === 'rejected') return { ...base, status: 'failed' as const, error: String(res.reason instanceof Error ? res.reason.message : res.reason) }
      if (res.value.error) return { ...base, status: 'failed' as const, error: res.value.error.message }
      return { ...base, status: 'sent' as const, resend_id: res.value.data?.id ?? null }
    }))
    emailed = results.some(r => r.status === 'fulfilled' && !r.value.error)
  }

  await recordJobRun(admin, 'watchdog', now, !problem, problem ?? 'Daily job ran within the expected window', { emailed })
  return { ok: !problem, problem, emailed }
}
