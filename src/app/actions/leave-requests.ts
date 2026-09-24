'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
import { distributeLeaveHours, applyLeaveToTimesheets, type LeavePostingSummary } from '@/lib/leave-timesheet'
import { notifyApprovers, notifyEmployee, getRecipient } from '@/lib/notifications'
import { fmtDate, fmtDateRange } from '@/lib/format-date'
import { LEAVE_EXPENSE_APPROVER_ROLES, TIMESHEET_APPROVER_ROLES, AUTO_APPROVED_LEAVE_TYPES, canSelfApprove } from '@/lib/constants/approvals'
import { REOPEN_OVERRIDE_ROLES } from '@/lib/constants/timesheet-reopen'
import type { LeaveType, Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

function rangeLabel(start: string, end: string) {
  return start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`
}

/**
 * Tells the right people what posting an approved leave request did to timesheets that were already
 * submitted/approved ("late leave"): reopened for re-review (payroll not yet due), or left untouched
 * because payroll was already due (needs a CEO override if pay must change).
 */
async function announceLeavePosting(admin: ReturnType<typeof createAdminClient>, employeeId: string, summary: LeavePostingSummary, leaveLabel: string) {
  if (summary.reopened.length === 0 && summary.held.length === 0) return
  const owner = await getRecipient(admin, employeeId)
  const ownerName = owner?.name ?? 'An employee'

  for (const r of summary.reopened) {
    const period = fmtDateRange(r.periodStart, r.periodEnd)
    await notifyEmployee(admin, employeeId, {
      kind: 'returned',
      title: 'Your timesheet was reopened — leave added',
      body: `Pay period ${period}\n${leaveLabel} was added to it. Review your entries and resubmit.`,
      link: '/timesheet',
      cta: 'Open Timesheet',
    })
    if (r.wasApproved) {
      await notifyApprovers(admin, employeeId, TIMESHEET_APPROVER_ROLES, {
        title: `Approved timesheet reopened: ${ownerName}`,
        body: `Pay period ${period} was reopened because ${leaveLabel} was added. It will return for re-approval once ${ownerName} resubmits.`,
      })
    }
  }

  for (const h of summary.held) {
    const period = fmtDateRange(h.periodStart, h.periodEnd)
    await notifyEmployee(admin, employeeId, {
      kind: 'returned',
      title: 'Leave approved after payroll was due',
      body: `Pay period ${period}\n${leaveLabel} was approved and your balance was updated, but payroll for that period was already due, so the timesheet was not changed. Contact your Accounting Manager if your pay needs adjusting.`,
      link: '/history',
      cta: 'View My Requests',
    })
    await notifyApprovers(admin, employeeId, REOPEN_OVERRIDE_ROLES, {
      title: `Leave approved after payroll due: ${ownerName}`,
      body: `${leaveLabel} falls in pay period ${period}, which is past its payroll due date. The timesheet was NOT changed. Use the CEO override (Approvals → Timesheets → Approved) if pay must be adjusted.`,
    })
  }
}

function balanceColumnFor(leaveType: LeaveType): 'pto_hours' | 'sick_hours' | 'personal_hours' | null {
  if (leaveType === 'PTO') return 'pto_hours'
  if (leaveType === 'Sick') return 'sick_hours'
  if (leaveType === 'Personal') return 'personal_hours'
  return null // Bereavement, Jury Duty — no balance column tracks these
}

export async function createLeaveRequest(data: {
  leave_type: LeaveType
  start_date: string
  end_date: string
  hours: number
  note: string
  attachment_path?: string
}) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  if (data.leave_type === 'Jury Duty' && !data.attachment_path) {
    throw new Error('Jury Duty requests require the summons attached.')
  }
  const admin = createAdminClient()

  // Auto-approved types (Sick) skip the approver when the balance covers the request.
  const col = balanceColumnFor(data.leave_type)
  let autoApprove = false
  let balanceBefore = 0
  if (col && AUTO_APPROVED_LEAVE_TYPES.includes(data.leave_type)) {
    const { data: balance, error: balError } = await admin.from('leave_balances').select('*').eq('employee_id', employee.id).maybeSingle()
    if (balError) throw new Error(balError.message)
    balanceBefore = balance ? Number(balance[col]) : 0
    autoApprove = balanceBefore >= data.hours
  }

  const now = new Date().toISOString()
  const { data: created, error } = await admin.from('leave_requests').insert({
    employee_id: employee.id,
    leave_type: data.leave_type,
    start_date: data.start_date,
    end_date: data.end_date,
    hours: data.hours,
    note: data.note || null,
    attachment_url: data.attachment_path || null,
    status: autoApprove ? 'approved' : 'pending',
    approved_at: autoApprove ? now : null,
    employee_signed_at: now,
  }).select('id').single()
  if (error) throw new Error(error.message)

  if (autoApprove && col) {
    const { error: deductError } = await admin.from('leave_balances').update({ [col]: balanceBefore - data.hours }).eq('employee_id', employee.id)
    if (deductError) {
      await admin.from('leave_requests').delete().eq('id', created.id) // don't leave an approved request with no balance deduction
      throw new Error(deductError.message)
    }
    const allocations = distributeLeaveHours(data.start_date, data.end_date, data.hours)
    const leaveLabel = `${data.leave_type} leave (${rangeLabel(data.start_date, data.end_date)})`
    const posting = await applyLeaveToTimesheets(admin, employee.id, data.leave_type, allocations, { actorId: employee.id, leaveLabel })
    await announceLeavePosting(admin, employee.id, posting, leaveLabel)

    await notifyEmployee(admin, employee.id, {
      kind: 'approved',
      title: `Your ${data.leave_type} leave was recorded`,
      body: `${data.leave_type} · ${rangeLabel(data.start_date, data.end_date)} · ${data.hours} hrs\nApproved automatically — ${data.leave_type} leave needs no approval while your balance covers it. New balance: ${balanceBefore - data.hours} hrs.`,
      link: '/history',
      cta: 'View My Requests',
    })
  } else {
    const overBalance = col && AUTO_APPROVED_LEAVE_TYPES.includes(data.leave_type)
    await notifyApprovers(admin, employee.id, LEAVE_EXPENSE_APPROVER_ROLES, {
      title: `Leave request from ${employee.name}`,
      body: `${data.leave_type} · ${rangeLabel(data.start_date, data.end_date)} · ${data.hours} hrs${overBalance ? ` (exceeds available balance of ${balanceBefore} hrs — needs approval)` : ''}${data.note ? `\nNote: ${data.note}` : ''}`,
    })
  }

  revalidatePath('/request')
  revalidatePath('/history')
  revalidatePath('/dashboard')
  revalidatePath('/timesheet')
  return { autoApproved: autoApprove }
}

export async function getLeaveAttachmentUploadUrl(fileName: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const ext = fileName.split('.').pop()
  const path = `${employee.id}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await admin.storage.from('leave-attachments').createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  return { signedUrl: data.signedUrl, path, token: data.token }
}

export async function getLeaveAttachmentViewUrl(requestId: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data: request, error: fetchError } = await admin.from('leave_requests').select('employee_id, attachment_url').eq('id', requestId).single()
  if (fetchError) throw new Error(fetchError.message)
  if (!request.attachment_url) return null
  if (request.employee_id !== employee.id && !MANAGER_ROLES.includes(employee.role)) throw new Error('Forbidden')
  const { data, error } = await admin.storage.from('leave-attachments').createSignedUrl(request.attachment_url, 60 * 10)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function getLeaveHistory(employeeId?: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const targetId = employeeId ?? employee.id
  if (targetId !== employee.id && !MANAGER_ROLES.includes(employee.role)) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leave_requests')
    .select('*, approver:employees!leave_requests_approver_id_fkey(name)')
    .eq('employee_id', targetId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => {
    const approver = r.approver as unknown as { name: string } | { name: string }[] | null
    const approver_name = Array.isArray(approver) ? approver[0]?.name : approver?.name
    return { ...r, approver_name: approver_name ?? null }
  })
}

export async function getTeamConflicts(startDate: string, endDate: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leave_requests')
    .select('start_date, end_date, employee:employees!leave_requests_employee_id_fkey(name)')
    .in('status', ['pending', 'approved'])
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .neq('employee_id', employee.id)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => {
    const emp = r.employee as unknown as { name: string } | { name: string }[]
    return {
      start_date: r.start_date,
      end_date: r.end_date,
      employee_name: Array.isArray(emp) ? emp[0]?.name : emp?.name,
    }
  })
}

export async function getMyBalance() {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data, error } = await admin.from('leave_balances').select('*').eq('employee_id', employee.id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function getMyRecentRequests(limit = 5) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leave_requests')
    .select('*')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getNextApprovedLeave() {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin
    .from('leave_requests')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('status', 'approved')
    .gt('start_date', today)
    .order('start_date')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function getPendingLeaveApprovals() {
  const actor = await requireRole(LEAVE_EXPENSE_APPROVER_ROLES)
  const admin = createAdminClient()
  let query = admin
    .from('leave_requests')
    .select('*, employee:employees!leave_requests_employee_id_fkey(name, avatar_url)')
    .eq('status', 'pending')
  // Your own request only shows in your queue if you're allowed to approve it yourself; otherwise it routes to another approver.
  if (!canSelfApprove(actor.role)) query = query.neq('employee_id', actor.id)
  const { data, error } = await query.order('created_at')
  if (error) throw new Error(error.message)

  const results = []
  for (const r of data ?? []) {
    const { data: balance } = await admin.from('leave_balances').select('*').eq('employee_id', r.employee_id).maybeSingle()
    const col = balanceColumnFor(r.leave_type as LeaveType)
    const current = col && balance ? Number(balance[col]) : null
    const emp = r.employee as unknown as { name: string } | { name: string }[]
    results.push({
      ...r,
      employee_name: Array.isArray(emp) ? emp[0]?.name : emp?.name,
      balance_current: current,
      balance_after: current !== null ? current - Number(r.hours) : null,
    })
  }
  return results
}

export async function getReviewedLeaveApprovals(limit = 30) {
  await requireRole(LEAVE_EXPENSE_APPROVER_ROLES)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leave_requests')
    .select('*, employee:employees!leave_requests_employee_id_fkey(name, avatar_url)')
    .in('status', ['approved', 'denied'])
    .order('approved_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => {
    const emp = r.employee as unknown as { name: string } | { name: string }[]
    return { ...r, employee_name: Array.isArray(emp) ? emp[0]?.name : emp?.name }
  })
}

export async function approveLeaveRequest(id: string) {
  const actor = await requireRole(LEAVE_EXPENSE_APPROVER_ROLES)
  const admin = createAdminClient()

  const { data: request, error: fetchError } = await admin.from('leave_requests').select('*').eq('id', id).single()
  if (fetchError) throw new Error(fetchError.message)
  if (request.status !== 'pending') throw new Error('This request has already been decided')
  if (request.employee_id === actor.id && !canSelfApprove(actor.role)) throw new Error("You can't approve your own request — it needs another approver.")

  const col = balanceColumnFor(request.leave_type as LeaveType)
  if (col) {
    const { data: balance, error: balError } = await admin.from('leave_balances').select('*').eq('employee_id', request.employee_id).maybeSingle()
    if (balError) throw new Error(balError.message)
    const current = balance ? Number(balance[col]) : 0
    if (current < Number(request.hours)) {
      throw new Error(`Insufficient balance — employee has ${current} hrs, request is for ${request.hours} hrs`)
    }
    const { error: updateBalError } = await admin.from('leave_balances').update({ [col]: current - Number(request.hours) }).eq('employee_id', request.employee_id)
    if (updateBalError) throw new Error(updateBalError.message)
  }

  const { error } = await admin.from('leave_requests').update({
    status: 'approved',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
    approver_signed_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(error.message)

  // Push the approved days onto the employee's timesheet(s), creating a
  // timesheet for any pay period they haven't opened yet. Pending/denied
  // requests never reach this — only an approval touches the timesheet.
  const allocations = distributeLeaveHours(request.start_date, request.end_date, Number(request.hours))
  const leaveLabel = `${request.leave_type} leave (${rangeLabel(request.start_date, request.end_date)})`
  const posting = await applyLeaveToTimesheets(admin, request.employee_id, request.leave_type as LeaveType, allocations, { actorId: actor.id, leaveLabel })
  await announceLeavePosting(admin, request.employee_id, posting, leaveLabel)

  await notifyEmployee(admin, request.employee_id, {
    kind: 'approved',
    title: `Your ${request.leave_type} request was approved`,
    body: `${request.leave_type} · ${rangeLabel(request.start_date, request.end_date)} · ${request.hours} hrs\nApproved by ${actor.name}.`,
    link: '/history',
    cta: 'View My Requests',
  })

  revalidatePath('/approvals')
  revalidatePath('/history')
  revalidatePath('/dashboard')
  revalidatePath('/timesheet')
}

export async function denyLeaveRequest(id: string, reason: string) {
  const actor = await requireRole(LEAVE_EXPENSE_APPROVER_ROLES)
  const admin = createAdminClient()
  const { data: request, error: fetchError } = await admin.from('leave_requests').select('status, employee_id, leave_type, start_date, end_date, hours').eq('id', id).single()
  if (fetchError) throw new Error(fetchError.message)
  if (request.status !== 'pending') throw new Error('This request has already been decided')
  if (request.employee_id === actor.id && !canSelfApprove(actor.role)) throw new Error("You can't deny your own request — it needs another approver.")

  const { error } = await admin.from('leave_requests').update({
    status: 'denied',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
    approver_signed_at: new Date().toISOString(),
    deny_reason: reason || null,
  }).eq('id', id)
  if (error) throw new Error(error.message)

  await notifyEmployee(admin, request.employee_id, {
    kind: 'denied',
    title: `Your ${request.leave_type} request was denied`,
    body: `${request.leave_type} · ${rangeLabel(request.start_date, request.end_date)} · ${request.hours} hrs\nDenied by ${actor.name}.${reason ? `\nReason: ${reason}` : ''}`,
    link: '/history',
    cta: 'View My Requests',
  })

  revalidatePath('/approvals')
  revalidatePath('/history')
  revalidatePath('/dashboard')
}
