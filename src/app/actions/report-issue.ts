'use server'

import { Resend } from 'resend'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
import type { IssueCategory, Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  login: 'Account / login trouble',
  pay_balance: 'Pay, balance, or timesheet discrepancy',
  timesheet: 'Timesheet issue',
  leave_request: 'Leave request issue',
  expense: 'Expense / mileage issue',
  other: 'Something else',
}

const REPORT_TO = 'communityhousingassociates@gmail.com'
const REPORT_CC = 'advisor@globalist.pro'

export async function reportIssue(data: { category: IssueCategory; description: string; page_url?: string; attachment_path?: string }) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')

  const description = data.description.trim()
  if (!description) throw new Error('Please describe the issue before submitting.')

  const admin = createAdminClient()
  const { error: insertError } = await admin.from('issue_reports').insert({
    employee_id: employee.id,
    category: data.category,
    description,
    page_url: data.page_url || null,
    attachment_url: data.attachment_path || null,
  })
  if (insertError) throw new Error(insertError.message)

  // The DB row is the durable record — admins see it in-app regardless of
  // what happens below. Email is a best-effort notification on top of that,
  // so a delivery hiccup here shouldn't make the report look like it failed.
  try {
    const categoryLabel = CATEGORY_LABELS[data.category] ?? 'Something else'
    const submittedDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll('/', '-')
    const submittedTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
    const submittedAt = `${submittedDate}, ${submittedTime}`

    let attachmentLink: string | null = null
    if (data.attachment_path) {
      const { data: signed } = await admin.storage.from('issue-attachments').createSignedUrl(data.attachment_path, 60 * 60 * 24 * 7)
      attachmentLink = signed?.signedUrl ?? null
    }

    const resend = new Resend(process.env.RESEND_API_KEY!)
    await resend.emails.send({
      from: 'CHA Employee Portal <portal@communityhousingassociates.org>',
      to: REPORT_TO,
      cc: REPORT_CC,
      replyTo: employee.email,
      subject: `[CHA Portal] ${categoryLabel} — ${employee.name}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#0b2b35;padding:16px 20px;border-radius:12px 12px 0 0">
            <span style="color:#fff;font-size:15px;font-weight:700">CHA Employee Portal — Issue Report</span>
          </div>
          <div style="border:1px solid #d4eef2;border-top:none;border-radius:0 0 12px 12px;padding:20px">
            <table style="width:100%;font-size:13px;color:#0b2b35;margin-bottom:16px">
              <tr><td style="padding:3px 0;color:#6b7280;width:110px">Reported by</td><td style="padding:3px 0;font-weight:600">${employee.name} (${employee.email})</td></tr>
              <tr><td style="padding:3px 0;color:#6b7280">Role</td><td style="padding:3px 0">${employee.job_title || employee.role}${employee.department ? ` · ${employee.department}` : ''}</td></tr>
              <tr><td style="padding:3px 0;color:#6b7280">Category</td><td style="padding:3px 0;font-weight:600">${categoryLabel}</td></tr>
              <tr><td style="padding:3px 0;color:#6b7280">Submitted</td><td style="padding:3px 0">${submittedAt} ET</td></tr>
              ${data.page_url ? `<tr><td style="padding:3px 0;color:#6b7280">Page</td><td style="padding:3px 0">${data.page_url}</td></tr>` : ''}
              ${attachmentLink ? `<tr><td style="padding:3px 0;color:#6b7280">Screenshot</td><td style="padding:3px 0"><a href="${attachmentLink}" style="color:#02ACC0">View attachment</a> (link expires in 7 days)</td></tr>` : ''}
            </table>
            <div style="background:#f9fefe;border:1px solid #f0f7f8;border-radius:8px;padding:12px 14px;font-size:13px;color:#0b2b35;white-space:pre-wrap">${description}</div>
            <p style="font-size:11px;color:#9ca3af;margin-top:16px">Reply to this email to respond directly to ${employee.name}. Full ticket, including the attachment, stays available in the portal's Issue Reports admin page.</p>
          </div>
        </div>
      `,
    })
  } catch (e) {
    console.error('reportIssue: email notification failed (ticket still logged)', e)
  }
}

export async function getIssueAttachmentUploadUrl(fileName: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const ext = fileName.split('.').pop()
  const path = `${employee.id}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await admin.storage.from('issue-attachments').createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  return { signedUrl: data.signedUrl, path, token: data.token }
}

export async function getIssueAttachmentViewUrl(issueId: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data: issue, error: fetchError } = await admin.from('issue_reports').select('employee_id, attachment_url').eq('id', issueId).single()
  if (fetchError) throw new Error(fetchError.message)
  if (!issue.attachment_url) return null
  if (issue.employee_id !== employee.id && !MANAGER_ROLES.includes(employee.role)) throw new Error('Forbidden')
  const { data, error } = await admin.storage.from('issue-attachments').createSignedUrl(issue.attachment_url, 60 * 10)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function getIssueReports() {
  await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('issue_reports')
    .select('*, employee:employees!issue_reports_employee_id_fkey(name, email, job_title, department, avatar_url)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function markIssueReviewed(id: string) {
  const actor = await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('issue_reports').update({
    status: 'reviewed',
    reviewed_by: actor.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/issues')
}

/** Reviewed and actually remediated — the terminal state, distinct from just "seen." */
export async function markIssueFixed(id: string, notes?: string) {
  const actor = await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('issue_reports').update({
    status: 'fixed',
    fixed_by: actor.id,
    fixed_at: new Date().toISOString(),
    fix_notes: notes?.trim() || null,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/issues')
}

/** Tickets not yet fixed (open or reviewed) — drives the sidebar badge. */
export async function getOpenIssueCount() {
  const employee = await getCurrentEmployee()
  if (!employee || !MANAGER_ROLES.includes(employee.role)) return 0
  const admin = createAdminClient()
  const { count, error } = await admin.from('issue_reports').select('id', { count: 'exact', head: true }).neq('status', 'fixed')
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Unfixed tickets created since this manager last saw the alert bell — drives its badge/animation. */
export async function getUnseenIssueCount() {
  const employee = await getCurrentEmployee()
  if (!employee || !MANAGER_ROLES.includes(employee.role)) return 0
  const admin = createAdminClient()
  let query = admin.from('issue_reports').select('id', { count: 'exact', head: true }).neq('status', 'fixed')
  if (employee.issues_seen_at) query = query.gt('created_at', employee.issues_seen_at)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Dismisses the alert bell for the current manager without requiring a full page visit. */
export async function markIssuesSeen() {
  const employee = await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ issues_seen_at: new Date().toISOString() }).eq('id', employee.id)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}
