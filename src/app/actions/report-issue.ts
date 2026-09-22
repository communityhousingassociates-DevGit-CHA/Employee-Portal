'use server'

import { Resend } from 'resend'
import { getCurrentEmployee } from '@/lib/auth/session'

export type IssueCategory =
  | 'login'
  | 'pay_balance'
  | 'timesheet'
  | 'leave_request'
  | 'expense'
  | 'other'

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

export async function reportIssue(data: { category: IssueCategory; description: string; page_url?: string }) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')

  const description = data.description.trim()
  if (!description) throw new Error('Please describe the issue before submitting.')

  const categoryLabel = CATEGORY_LABELS[data.category] ?? 'Something else'
  const submittedAt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })

  const resend = new Resend(process.env.RESEND_API_KEY!)

  const { error } = await resend.emails.send({
    from: 'CHA Employee Portal <notify@globalist.pro>',
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
          </table>
          <div style="background:#f9fefe;border:1px solid #f0f7f8;border-radius:8px;padding:12px 14px;font-size:13px;color:#0b2b35;white-space:pre-wrap">${description}</div>
          <p style="font-size:11px;color:#9ca3af;margin-top:16px">Reply to this email to respond directly to ${employee.name}.</p>
        </div>
      </div>
    `,
  })

  if (error) throw new Error(error.message || 'Failed to send report — please try again or email the Accounting Manager directly.')
}
