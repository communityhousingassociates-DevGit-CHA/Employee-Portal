// Automated reminders for staff who were invited to the portal but never finished setting a password. Runs from the daily cron.
//
// Rather than rely on the original invite link (which expires), each reminder carries a FRESH link: the person's unused auth account
// is replaced (same guard as "Resend Invite": never set a password, never logged in) and a new invite token is generated without
// Supabase sending its own email — we send the reminder ourselves so the wording says "reminder". The newest email always works.
// Not a 'use server' file: it deletes and recreates auth accounts and must only run behind the cron secret.

import { UserError } from '@/lib/user-error'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getAuthUserInfo } from '@/lib/auth-users'
import { INVITE_VALID_HOURS } from '@/lib/constants/invites'
import { logEmails } from '@/lib/notifications'
import { PORTAL_REPLY_TO } from '@/lib/constants/email'

const FROM = 'CHA Employee Portal <portal@communityhousingassociates.org>'
const KIND = 'invite_reminder'
/** Don't remind someone whose invite (or last reminder) went out less than this long ago. */
const MIN_HOURS_BETWEEN = 12
/** Stop after this many reminders per invite — the manager summary keeps listing them, and a person can be re-invited by hand. */
const MAX_REMINDERS = 7

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export type ReminderSummary = { reminded: string[]; failed: { name: string; error: string }[]; skipped: number }

function reminderEmail(firstName: string, link: string) {
  return `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#0b2b35;padding:16px 20px;border-radius:12px 12px 0 0"><span style="color:#fff;font-size:15px;font-weight:700">CHA Employee Portal</span></div>
      <div style="border:1px solid #d4eef2;border-top:none;border-radius:0 0 12px 12px;padding:22px;color:#0b2b35">
        <p style="font-size:14px;margin:0 0 12px">Hi ${esc(firstName || 'there')},</p>
        <p style="font-size:16px;font-weight:700;margin:0 0 10px">Please finish setting up your portal account</p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#374151">Your CHA Employee Portal account is ready, but you haven&rsquo;t set a password yet. It takes about a minute, and it&rsquo;s how you&rsquo;ll enter time, request leave, and check your balances.</p>
        <p style="margin:0 0 18px"><a href="${link}" style="background:#02ACC0;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 26px;border-radius:8px;display:inline-block">Set up my account</a></p>
        <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 8px">This link is valid for ${INVITE_VALID_HOURS} hours. If you get another reminder, use the newest email &mdash; older links stop working.</p>
        <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0">Button not working? Copy this link into your browser:<br><span style="word-break:break-all">${esc(link)}</span></p>
        <p style="font-size:12px;color:#6b7280;margin:16px 0 0">Questions? Email <a href="mailto:support@globalist.pro" style="color:#028a9e">support@globalist.pro</a>.</p>
      </div>
    </div>`
}

export async function sendInviteReminders(admin: SupabaseClient, now: Date = new Date()): Promise<ReminderSummary> {
  const out: ReminderSummary = { reminded: [], failed: [], skipped: 0 }
  const origin = process.env.NEXT_PUBLIC_SITE_URL
  if (!process.env.RESEND_API_KEY || !origin) return out

  const { data: staff, error } = await admin.from('employees')
    .select('id, name, email, first_name, user_id, login_count')
    .eq('is_active', true).eq('is_test_account', false).not('user_id', 'is', null)
  if (error) throw new Error(error.message)
  const authInfo = await getAuthUserInfo(admin)
  const resend = new Resend(process.env.RESEND_API_KEY)

  for (const emp of staff ?? []) {
    const info = authInfo.get(emp.user_id as string)
    // Only people who have never finished setup: no password set through the portal and never signed in.
    if (!info || info.passwordSet || (emp.login_count ?? 0) > 0 || !info.invitedAt) continue

    // Reminders already sent for this invite (email_log), and when the last one went.
    const { data: prior } = await admin.from('email_log').select('created_at').eq('kind', KIND).eq('recipient_email', emp.email).eq('status', 'sent').gte('created_at', info.invitedAt).order('created_at', { ascending: false })
    const lastAt = prior?.[0]?.created_at ?? info.invitedAt
    if ((prior?.length ?? 0) >= MAX_REMINDERS || now.getTime() - Date.parse(lastAt) < MIN_HOURS_BETWEEN * 3600000) { out.skipped++; continue }

    try {
      // Replace the unused account (it can't hold anything yet), then mint a fresh invite token without emailing.
      const { error: unlink } = await admin.from('employees').update({ user_id: null }).eq('id', emp.id)
      if (unlink) throw new UserError(unlink.message)
      const { error: del } = await admin.auth.admin.deleteUser(emp.user_id as string)
      if (del) { await admin.from('employees').update({ user_id: emp.user_id }).eq('id', emp.id); throw new UserError(del.message) }

      const { data: gen, error: genError } = await admin.auth.admin.generateLink({
        type: 'invite', email: emp.email,
        options: { data: { first_name: emp.first_name }, redirectTo: `${origin}/set-password` },
      })
      if (genError || !gen?.user || !gen.properties?.hashed_token) throw new UserError(`${genError?.message ?? 'no token returned'} — this person's login was reset; use "Send Invite" in User Management`)
      const { error: relink } = await admin.from('employees').update({ user_id: gen.user.id }).eq('id', emp.id)
      if (relink) throw new UserError(relink.message)

      const link = `${origin}/set-password?token_hash=${encodeURIComponent(gen.properties.hashed_token)}&type=invite`
      const subject = '[CHA Portal] Reminder: please finish setting up your account'
      const sent = await resend.emails.send({ from: FROM, replyTo: PORTAL_REPLY_TO, to: emp.email, subject, html: reminderEmail(emp.first_name ?? '', link) })
      await logEmails(admin, [{ source: 'notification', kind: KIND, recipient_email: emp.email, subject, status: sent.error ? 'failed' : 'sent', error: sent.error?.message ?? null, resend_id: sent.data?.id ?? null }])
      if (sent.error) throw new UserError(sent.error.message)
      out.reminded.push(emp.name as string)
    } catch (e) {
      out.failed.push({ name: emp.name as string, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return out
}
