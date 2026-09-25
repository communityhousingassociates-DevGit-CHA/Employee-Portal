import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationKind, Role } from '@/types'
import { NOTIFICATION_TEST_MODE } from '@/lib/constants/approvals'

const FROM = 'CHA Employee Portal <portal@communityhousingassociates.org>'

export type Recipient = { id: string; email: string; name: string; role?: Role }

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.communityhousingassociates.org').replace(/\/$/, '')
}

const ACCENT: Record<NotificationKind, string> = {
  approval_needed: '#02ACC0',
  approved: '#059669',
  denied: '#dc2626',
  returned: '#d97706',
}

function renderEmail(recipient: Pick<Recipient, 'name'>, n: { kind: NotificationKind; title: string; body: string; link: string; cta: string; testNote?: string }) {
  const firstName = escapeHtml(recipient.name.split(' ')[0] || 'there')
  return `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#0b2b35;padding:16px 20px;border-radius:12px 12px 0 0">
        <span style="color:#fff;font-size:15px;font-weight:700">CHA Employee Portal</span>
      </div>
      <div style="border:1px solid #d4eef2;border-top:none;border-radius:0 0 12px 12px;padding:20px;color:#0b2b35">
        ${n.testNote ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:12px;color:#92400e;margin:0 0 14px"><strong>TEST MODE</strong> — ${escapeHtml(n.testNote)}</div>` : ''}
        <p style="font-size:14px;margin:0 0 12px">Hi ${firstName},</p>
        <p style="font-size:16px;font-weight:700;margin:0 0 8px;color:${ACCENT[n.kind]}">${escapeHtml(n.title)}</p>
        <div style="background:#f9fefe;border:1px solid #f0f7f8;border-radius:8px;padding:12px 14px;font-size:13px;white-space:pre-wrap">${escapeHtml(n.body)}</div>
        <p style="margin:20px 0 0"><a href="${siteUrl()}${n.link}" style="background:#02ACC0;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 18px;border-radius:8px;display:inline-block">${escapeHtml(n.cta)}</a></p>
        <p style="font-size:11px;color:#9ca3af;margin-top:20px">You're receiving this because of activity on your Community Housing Associates employee portal account.</p>
      </div>
    </div>`
}

export type EmailLogEntry = { source: 'notification' | 'issue_report'; kind?: string; recipient_email: string; subject: string; status: 'sent' | 'failed' | 'skipped'; resend_id?: string | null; error?: string | null }

/** Records the outcome of an email send in `email_log`. Never throws — logging must not break the action that sent the email. */
export async function logEmails(admin: SupabaseClient, entries: EmailLogEntry[]) {
  if (entries.length === 0) return
  try {
    const { error } = await admin.from('email_log').insert(entries.map(e => ({ ...e, kind: e.kind ?? null, resend_id: e.resend_id ?? null, error: e.error ?? null })))
    if (error) console.error('logEmails: could not save email log', error.message)
  } catch (e) {
    console.error('logEmails: could not save email log', e)
  }
}

/**
 * Notifies each recipient in-portal (a `notifications` row, shown in the topbar
 * bell) and by email. Best-effort by design: the request/expense/timesheet the
 * caller just saved is the source of truth, so a delivery failure here is
 * logged and swallowed — it must never make the underlying action look failed.
 */
export async function notify(
  admin: SupabaseClient,
  recipients: Recipient[],
  n: { kind: NotificationKind; title: string; body: string; link: string; cta?: string },
  // Where emails actually go, when that differs from who gets the in-portal notice (test mode).
  email?: { to: Pick<Recipient, 'email' | 'name'>[]; testNote?: string },
) {
  if (recipients.length === 0) return
  const cta = n.cta ?? 'Open in Portal'

  try {
    const { error } = await admin.from('notifications').insert(
      recipients.map(r => ({ employee_id: r.id, kind: n.kind, title: n.title, body: n.body, link: n.link })),
    )
    if (error) console.error('notify: failed to save in-portal notification', error.message)
  } catch (e) {
    console.error('notify: failed to save in-portal notification', e)
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('notify: RESEND_API_KEY not set — skipping email')
    await logEmails(admin, recipients.map(r => ({ source: 'notification', kind: n.kind, recipient_email: r.email, subject: `[CHA Portal] ${n.title}`, status: 'skipped', error: 'RESEND_API_KEY not set' })))
    return
  }
  const emailTo = email?.to ?? recipients.filter(r => !(NOTIFICATION_TEST_MODE.enabled && r.role && NOTIFICATION_TEST_MODE.neverEmailRoles.includes(r.role)))
  if (emailTo.length === 0) return
  const resend = new Resend(process.env.RESEND_API_KEY)
  const subject = `${email?.testNote ? '[TEST] ' : ''}[CHA Portal] ${n.title}`
  const results = await Promise.allSettled(
    emailTo.map(r =>
      resend.emails.send({
        from: FROM,
        to: r.email,
        subject,
        html: renderEmail(r, { kind: n.kind, title: n.title, body: n.body, link: n.link, cta, testNote: email?.testNote }),
      }),
    ),
  )
  const log: EmailLogEntry[] = []
  results.forEach((res, i) => {
    const base = { source: 'notification' as const, kind: n.kind, recipient_email: emailTo[i].email, subject }
    if (res.status === 'rejected') {
      console.error(`notify: email to ${emailTo[i].email} failed`, res.reason)
      log.push({ ...base, status: 'failed', error: String(res.reason instanceof Error ? res.reason.message : res.reason) })
    } else if (res.value.error) {
      console.error(`notify: email to ${emailTo[i].email} failed`, res.value.error)
      log.push({ ...base, status: 'failed', error: res.value.error.message })
    } else log.push({ ...base, status: 'sent', resend_id: res.value.data?.id ?? null })
  })
  await logEmails(admin, log)
}

/**
 * Everyone holding one of the approver roles, minus the person who just
 * submitted and minus dev/test accounts. If that leaves nobody, fall back to
 * including test accounts (same roles) so a submission is never silently unrouted.
 */
export async function getApprovers(admin: SupabaseClient, excludeEmployeeId: string, roles: Role[]): Promise<Recipient[]> {
  const base = () =>
    admin.from('employees').select('id, email, name, role').in('role', roles).eq('is_active', true).neq('id', excludeEmployeeId)
  // In test mode the dev/test accounts are legitimate approvers (that's who is doing the testing).
  if (NOTIFICATION_TEST_MODE.enabled) {
    const { data: all } = await base()
    if (all && all.length > 0) return all as Recipient[]
  }
  const { data } = await base().eq('is_test_account', false)
  if (data && data.length > 0) return data as Recipient[]
  const { data: fallback } = await base()
  return (fallback ?? []) as Recipient[]
}

export async function getRecipient(admin: SupabaseClient, employeeId: string): Promise<Recipient | null> {
  const { data } = await admin.from('employees').select('id, email, name, role').eq('id', employeeId).maybeSingle()
  return (data as Recipient | null) ?? null
}

type Payload = { kind: NotificationKind; title: string; body: string; link: string; cta?: string }

/** Tells every approver holding one of `roles` (except the submitter) that something is waiting in their Approvals queue. Never throws. */
export async function notifyApprovers(admin: SupabaseClient, submitterId: string, roles: Role[], payload: Omit<Payload, 'kind' | 'link'>) {
  try {
    const approvers = await getApprovers(admin, submitterId, roles)
    const n = { ...payload, kind: 'approval_needed' as const, link: '/approvals', cta: payload.cta ?? 'Review in Portal' }
    if (!NOTIFICATION_TEST_MODE.enabled) return await notify(admin, approvers, n)

    // Test mode: approvers still get the in-portal notice, but the email alert goes to the test recipients
    // (never the submitter) with a note about who it would normally have reached.
    const { data: submitter } = await admin.from('employees').select('email').eq('id', submitterId).maybeSingle()
    const testAddrs = NOTIFICATION_TEST_MODE.emailRecipients.filter(addr => addr.toLowerCase() !== submitter?.email?.toLowerCase())
    const { data: known } = await admin.from('employees').select('email, name').in('email', testAddrs)
    const testTo = testAddrs.map(addr => ({ email: addr, name: known?.find(k => k.email.toLowerCase() === addr.toLowerCase())?.name ?? 'there' }))
    const normally = approvers.map(a => a.name).join(', ') || 'no one'
    await notify(admin, approvers, n, { to: testTo, testNote: `this alert would normally go to: ${normally}.` })
  } catch (e) {
    console.error('notifyApprovers failed', e)
  }
}

/** Tells one employee the outcome of something they submitted. Never throws. */
export async function notifyEmployee(admin: SupabaseClient, employeeId: string, payload: Payload) {
  try {
    const recipient = await getRecipient(admin, employeeId)
    if (recipient) await notify(admin, [recipient], payload)
  } catch (e) {
    console.error('notifyEmployee failed', e)
  }
}
