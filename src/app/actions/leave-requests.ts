'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
import { distributeLeaveHours, applyLeaveToTimesheets, removeLeaveFromTimesheets, dailyLeaveOverage, type LeavePostingSummary } from '@/lib/leave-timesheet'
import { notifyApprovers, notifyEmployee, getRecipient } from '@/lib/notifications'
import { fmtDate, fmtDateRange } from '@/lib/format-date'
import { LEAVE_EXPENSE_APPROVER_ROLES, TIMESHEET_APPROVER_ROLES, AUTO_APPROVED_LEAVE_TYPES, canSelfApprove } from '@/lib/constants/approvals'
import { REOPEN_OVERRIDE_ROLES } from '@/lib/constants/timesheet-reopen'
import { earliestLeaveDate, LEAVE_BACKDATE_DAYS, latestLeaveDate, latestSickLeaveDate } from '@/lib/leave-window'
import { loadClosedRanges } from '@/lib/period-lock'
import { closedRangeOverlapping, todayET, deductThroughDate } from '@/lib/pay-periods'
import { denyReasonProblem } from '@/lib/deny-reason'
import { loadProjectionContext, deductRequestFromBalance } from '@/lib/leave-deductions'
import { balanceTypeFor, projectedAvailable } from '@/lib/leave-projection'
import type { LeaveType, Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

function rangeLabel(start: string, end: string) {
  return start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`
}

/**
 * Tells the right people what posting an approved leave request did to timesheets that were already
 * submitted/approved ("late leave"): reopened for re-review, or left untouched because the period
 * is closed by accounting (needs a CEO override if pay must change).
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
      title: 'Leave approved for a closed period',
      body: `Pay period ${period}\n${leaveLabel} was approved and your balance was updated, but accounting has closed that period, so the timesheet was not changed. Contact your Accounting Manager if your pay needs adjusting.`,
      link: '/history',
      cta: 'View My Requests',
    })
    await notifyApprovers(admin, employeeId, REOPEN_OVERRIDE_ROLES, {
      title: `Leave approved for a closed period: ${ownerName}`,
      body: `${leaveLabel} falls in pay period ${period}, which accounting has closed. The timesheet was NOT changed. Use the CEO override (Approvals → Timesheets → Approved) if pay must be adjusted.`,
    })
  }
}

function balanceColumnFor(leaveType: LeaveType): 'pto_hours' | 'sick_hours' | 'personal_hours' | null {
  if (leaveType === 'PTO') return 'pto_hours'
  if (leaveType === 'Sick') return 'sick_hours'
  if (leaveType === 'Personal') return 'personal_hours'
  return null // Bereavement, Jury Duty — no balance column tracks these
}

type LeaveDay = { date: string; hours: number }

/** Everything that can reject one day of leave before anything is saved. Throws a plain-language message. */
async function checkLeaveDay(admin: ReturnType<typeof createAdminClient>, employeeId: string, leaveType: LeaveType, day: LeaveDay, closedRanges: Awaited<ReturnType<typeof loadClosedRanges>>) {
  const label = fmtDate(day.date)
  if (!(day.hours > 0)) throw new Error(`${label}: enter the hours for this day.`)
  if (leaveType === 'Sick' && day.date > latestSickLeaveDate()) {
    throw new Error(`${label}: sick leave can only be entered for today or earlier — it can’t be planned in advance. Use PTO or Vacation for planned time off.`)
  }
  if (day.date > latestLeaveDate()) {
    throw new Error(`${label}: leave can be requested through ${fmtDate(latestLeaveDate())}. For later dates, contact your Accounting Manager.`)
  }
  const earliest = earliestLeaveDate()
  if (day.date < earliest) {
    throw new Error(`${label}: leave can be entered up to ${LEAVE_BACKDATE_DAYS} days back (from ${fmtDate(earliest)}). For earlier dates, contact your Accounting Manager.`)
  }
  const closedHit = closedRangeOverlapping(day.date, day.date, closedRanges)
  if (closedHit) {
    throw new Error(`${label} is in ${fmtDate(closedHit.start)} – ${fmtDate(closedHit.end)}, which accounting has closed, so no new leave can be entered for it. Contact your Accounting Manager.`)
  }
  const overage = await dailyLeaveOverage(admin, employeeId, day.date, day.date, day.hours)
  if (overage) throw new Error(`${label}: ${overage}`)
}

type CreatedDay = { id: string; date: string; hours: number; autoApproved: boolean; overBalance: boolean; balanceAfter: number | null }

/** Saves one day of leave as its own request (auto-approving Sick that the balance covers). Notifications are sent by the caller. */
async function createLeaveDay(
  admin: ReturnType<typeof createAdminClient>,
  employee: { id: string },
  common: { leave_type: LeaveType; note: string; attachment_path?: string },
  day: LeaveDay,
): Promise<CreatedDay> {
  const col = balanceColumnFor(common.leave_type)
  let autoApprove = false
  let balanceBefore = 0
  if (col && AUTO_APPROVED_LEAVE_TYPES.includes(common.leave_type)) {
    const { data: balance, error: balError } = await admin.from('leave_balances').select('*').eq('employee_id', employee.id).maybeSingle()
    if (balError) throw new Error(balError.message)
    balanceBefore = balance ? Number(balance[col]) : 0
    autoApprove = balanceBefore >= day.hours
  }

  const now = new Date().toISOString()
  const { data: created, error } = await admin.from('leave_requests').insert({
    employee_id: employee.id,
    leave_type: common.leave_type,
    start_date: day.date,
    end_date: day.date,
    hours: day.hours,
    note: common.note || null,
    attachment_url: common.attachment_path || null,
    status: autoApprove ? 'approved' : 'pending',
    approved_at: autoApprove ? now : null,
    // Auto-approved leave is never in the future (sick can't be planned), so its hours come off right away.
    balance_deducted_at: autoApprove ? now : null,
    employee_signed_at: now,
  }).select('id').single()
  if (error) throw new Error(error.message)

  let balanceAfter: number | null = null
  if (autoApprove && col) {
    balanceAfter = Math.round((balanceBefore - day.hours) * 100) / 100
    const { error: deductError } = await admin.from('leave_balances').update({ [col]: balanceAfter }).eq('employee_id', employee.id)
    if (deductError) {
      await admin.from('leave_requests').delete().eq('id', created.id) // don't leave an approved request with no balance deduction
      throw new Error(deductError.message)
    }
    const allocations = distributeLeaveHours(day.date, day.date, day.hours)
    const leaveLabel = `${common.leave_type} leave (${fmtDate(day.date)})`
    const posting = await applyLeaveToTimesheets(admin, employee.id, common.leave_type, allocations, { actorId: employee.id, leaveLabel })
    await announceLeavePosting(admin, employee.id, posting, leaveLabel)
  }
  return {
    id: created.id, date: day.date, hours: day.hours, autoApproved: autoApprove,
    overBalance: !!col && AUTO_APPROVED_LEAVE_TYPES.includes(common.leave_type) && !autoApprove,
    balanceAfter,
  }
}

/**
 * Every day is its own request, so each day carries its own hours (a half day is 4 hrs), and approvers approve or deny —
 * and employees cancel — one day at a time. All days are validated before any is saved; approvers get one combined
 * alert (and the employee one combined confirmation for auto-approved Sick) rather than a message per day.
 */
export async function createLeaveRequests(data: {
  leave_type: LeaveType
  days: LeaveDay[]
  note: string
  attachment_path?: string
}) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  if (data.leave_type === 'Jury Duty' && !data.attachment_path) {
    throw new Error('Jury Duty requests require the summons attached.')
  }
  const days = [...data.days].map(d => ({ date: d.date, hours: Number(d.hours) })).sort((a, b) => a.date.localeCompare(b.date))
  if (days.length === 0) throw new Error('Add at least one day.')
  if (days.length > 31) throw new Error('A single submission can cover up to 31 days.')

  // The same date entered twice can't add up to more than a full day.
  const perDate = new Map<string, number>()
  for (const d of days) perDate.set(d.date, (perDate.get(d.date) ?? 0) + d.hours)
  for (const [date, hrs] of perDate) {
    if (hrs > 8) throw new Error(`${fmtDate(date)}: the hours you entered for this date add up to ${hrs}, but a day can’t exceed 8 hours.`)
  }

  const admin = createAdminClient()
  const closedRanges = await loadClosedRanges(admin)
  for (const d of days) if (!(d.hours > 0)) throw new Error(`${fmtDate(d.date)}: enter the hours for this day.`)
  // Check each date's total against leave already saved (rows for the same date are judged together).
  for (const [date, hours] of perDate) {
    await checkLeaveDay(admin, employee.id, data.leave_type, { date, hours }, closedRanges)
  }

  const common = { leave_type: data.leave_type, note: data.note, attachment_path: data.attachment_path }
  const created: CreatedDay[] = []
  for (const d of days) created.push(await createLeaveDay(admin, employee, common, d))

  const lines = (list: CreatedDay[]) => list.map(c => `${fmtDate(c.date)} · ${c.hours} hrs`).join('\n')
  const auto = created.filter(c => c.autoApproved)
  const pending = created.filter(c => !c.autoApproved)
  const lastBalance = auto.length > 0 ? auto[auto.length - 1].balanceAfter : null
  if (auto.length > 0) {
    await notifyEmployee(admin, employee.id, {
      kind: 'approved',
      title: auto.length === 1 ? `Your ${data.leave_type} leave was recorded` : `Your ${data.leave_type} leave was recorded (${auto.length} days)`,
      body: `${data.leave_type}\n${lines(auto)}\nApproved automatically — ${data.leave_type} leave needs no approval while your balance covers it.${lastBalance !== null ? ` New balance: ${lastBalance} hrs.` : ''}`,
      link: '/history',
      cta: 'View My Requests',
    })
  }
  if (pending.length > 0) {
    const over = pending.some(p => p.overBalance)
    await notifyApprovers(admin, employee.id, LEAVE_EXPENSE_APPROVER_ROLES, {
      title: pending.length === 1 ? `Leave request from ${employee.name}` : `Leave request from ${employee.name} (${pending.length} days)`,
      body: `${data.leave_type}${pending.length > 1 ? ` — each day is its own request` : ''}\n${lines(pending)}${over ? '\n(Exceeds the available sick balance — needs approval.)' : ''}${data.note ? `\nNote: ${data.note}` : ''}`,
    })
  }

  revalidatePath('/request')
  revalidatePath('/history')
  revalidatePath('/dashboard')
  revalidatePath('/timesheet')
  return { autoApproved: pending.length === 0, autoApprovedDays: auto.length, pendingDays: pending.length }
}

/** Live check for the request form: null when every day fits, otherwise why not (the first problem found). */
export async function checkMyLeaveDays(days: LeaveDay[]) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const perDate = new Map<string, number>()
  for (const d of days) if (d.date && d.hours > 0) perDate.set(d.date, (perDate.get(d.date) ?? 0) + Number(d.hours))
  for (const [date, hours] of perDate) {
    const problem = await dailyLeaveOverage(admin, employee.id, date, date, hours)
    if (problem) return `${fmtDate(date)}: ${problem}`
  }
  return null
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
    // Leave beyond the two-pay-period window is only reserved on approval, so "balance after" would be misleading:
    // show what the employee is projected to have on the start date instead.
    const balanceType = balanceTypeFor(r.leave_type as LeaveType)
    const reserveOnly = !!balanceType && current !== null && r.start_date > deductThroughDate()
    let projectedAfter: number | null = null
    if (reserveOnly && balanceType && current !== null) {
      const ctx = await loadProjectionContext(admin, r.employee_id)
      const proj = projectedAvailable({ type: balanceType, onDate: r.start_date, current, reserved: ctx.reserved.filter(x => x.id !== r.id), hireDate: ctx.hireDate, ptoUncapped: ctx.ptoUncapped, accrualsOn: ctx.accrualsOn })
      projectedAfter = proj.projected - Number(r.hours)
    }
    results.push({
      ...r,
      employee_name: Array.isArray(emp) ? emp[0]?.name : emp?.name,
      balance_current: current,
      balance_after: current !== null ? current - Number(r.hours) : null,
      reserve_only: reserveOnly,
      projected_after: projectedAfter,
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
  const closedHit = closedRangeOverlapping(request.start_date, request.end_date, await loadClosedRanges(admin))
  if (closedHit) {
    throw new Error(`This request falls in dates accounting has closed (${fmtDate(closedHit.start)} – ${fmtDate(closedHit.end)}). Deny it, or ask the CEO to lift the closure first.`)
  }

  const overage = await dailyLeaveOverage(admin, request.employee_id, request.start_date, request.end_date, Number(request.hours), id)
  if (overage) throw new Error(`${overage} Deny this request instead.`)

  // Leave that has begun, or starts within the next two pay periods, comes off the balance now (and must be covered by
  // it). Leave planned further out is RESERVED instead: it's judged against the balance projected for its start date
  // (today's balance plus the accruals that will land by then, minus other reserved leave) and is deducted by the daily
  // job once it comes within that window.
  const col = balanceColumnFor(request.leave_type as LeaveType)
  const balanceType = balanceTypeFor(request.leave_type as LeaveType)
  const startsLater = request.start_date > deductThroughDate()
  if (col && balanceType) {
    const { data: balance, error: balError } = await admin.from('leave_balances').select('*').eq('employee_id', request.employee_id).maybeSingle()
    if (balError) throw new Error(balError.message)
    const current = balance ? Number(balance[col]) : 0
    if (!startsLater) {
      if (current < Number(request.hours)) {
        throw new Error(`Insufficient balance — employee has ${current} hrs, request is for ${request.hours} hrs. Leave this close comes off the current balance when approved.`)
      }
    } else {
      const ctx = await loadProjectionContext(admin, request.employee_id)
      const proj = projectedAvailable({ type: balanceType, onDate: request.start_date, current, reserved: ctx.reserved.filter(r => r.id !== id), hireDate: ctx.hireDate, ptoUncapped: ctx.ptoUncapped, accrualsOn: ctx.accrualsOn })
      if (proj.projected < Number(request.hours)) {
        throw new Error(
          `Projected balance on ${fmtDate(request.start_date)} is ${proj.projected} hrs (${current} now + ${proj.accrued} accruing − ${proj.reservedBefore} already reserved)` +
          `${ctx.accrualsOn ? '' : ' — accruals are not switched on, so none are projected'}; this request is for ${request.hours} hrs.`,
        )
      }
    }
  }

  const { error } = await admin.from('leave_requests').update({
    status: 'approved',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
    approver_signed_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  if (col && !startsLater) await deductRequestFromBalance(admin, { id, employee_id: request.employee_id, leave_type: request.leave_type as LeaveType, hours: Number(request.hours) })

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
  const reasonProblem = denyReasonProblem(reason)
  if (reasonProblem) throw new Error(reasonProblem)
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
    deny_reason: reason.trim(),
  }).eq('id', id)
  if (error) throw new Error(error.message)

  await notifyEmployee(admin, request.employee_id, {
    kind: 'denied',
    title: `Your ${request.leave_type} request was denied`,
    body: `${request.leave_type} · ${rangeLabel(request.start_date, request.end_date)} · ${request.hours} hrs\nDenied by ${actor.name}.\nReason: ${reason.trim()}`,
    link: '/history',
    cta: 'View My Requests',
  })

  revalidatePath('/approvals')
  revalidatePath('/history')
  revalidatePath('/dashboard')
}

/**
 * Lets employees undo their own mistake without an approver: a pending request, an auto-approved one (Sick), or approved
 * leave that hasn't started yet (its hours go back on the balance if they were already deducted). Leave an approver
 * approved that has started stays with the approvers. Restores any deducted balance and takes the hours back off the timesheet.
 */
export async function cancelMyLeaveRequest(id: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data: request, error: fetchError } = await admin.from('leave_requests').select('*').eq('id', id).single()
  if (fetchError) throw new Error(fetchError.message)
  if (request.employee_id !== employee.id) throw new Error('Forbidden')
  if (request.status === 'denied' || request.status === 'cancelled') throw new Error('This request is already closed.')

  const deducted = !!request.balance_deducted_at
  const selfService = request.status === 'pending' || !request.approver_id || request.start_date > todayET()
  if (!selfService) throw new Error('This leave was approved by an approver and has already started, so it needs your Accounting Manager to change it.')

  const closedHit = closedRangeOverlapping(request.start_date, request.end_date, await loadClosedRanges(admin))
  if (closedHit) throw new Error(`${fmtDate(closedHit.start)} – ${fmtDate(closedHit.end)} has been closed by accounting, so this request can’t be cancelled here. Contact your Accounting Manager.`)

  // Claim the cancel first so a double-click can't restore the balance twice.
  const { data: claimed, error: claimError } = await admin.from('leave_requests')
    .update({ status: 'cancelled', deny_reason: 'Cancelled by employee' })
    .eq('id', id).eq('status', request.status).select('id').maybeSingle()
  if (claimError) throw new Error(claimError.message)
  if (!claimed) throw new Error('This request was just changed — refresh and try again.')

  const col = balanceColumnFor(request.leave_type)
  let newBalance: number | null = null
  if (deducted && col) {
    const { data: balance, error: balError } = await admin.from('leave_balances').select('*').eq('employee_id', employee.id).maybeSingle()
    if (balError) throw new Error(balError.message)
    newBalance = Math.round((Number(balance?.[col] ?? 0) + Number(request.hours)) * 100) / 100
    const { error: restoreError } = await admin.from('leave_balances').update({ [col]: newBalance }).eq('employee_id', employee.id)
    if (restoreError) throw new Error(restoreError.message)
  }

  if (request.status === 'approved') {
    const allocations = distributeLeaveHours(request.start_date, request.end_date, Number(request.hours))
    const leaveLabel = `${request.leave_type} leave (${rangeLabel(request.start_date, request.end_date)})`
    await removeLeaveFromTimesheets(admin, employee.id, request.leave_type, allocations, { actorId: employee.id, leaveLabel })
  }

  await notifyEmployee(admin, employee.id, {
    kind: 'approved',
    title: `Your ${request.leave_type} request was cancelled`,
    body: `${request.leave_type} · ${rangeLabel(request.start_date, request.end_date)} · ${request.hours} hrs\nCancelled by you.${newBalance !== null ? ` The ${request.hours} hrs went back to your balance.` : ''}`,
    link: '/history',
    cta: 'View My Requests',
  })

  revalidatePath('/request')
  revalidatePath('/history')
  revalidatePath('/dashboard')
  revalidatePath('/timesheet')
  revalidatePath('/approvals')
}

/**
 * What the employee's balances will look like: today's balance, the approved-but-not-yet-deducted ("reserved") leave, and
 * whether each reservation is covered by the balance projected for its start date. Feeds the dashboard note and the
 * projection on the request form.
 */
export async function getMyLeaveOutlook() {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const ctx = await loadProjectionContext(admin, employee.id)
  const { data: balance } = await admin.from('leave_balances').select('*').eq('employee_id', employee.id).maybeSingle()
  const current = { pto: Number(balance?.pto_hours ?? 0), sick: Number(balance?.sick_hours ?? 0), vacation: Number(balance?.personal_hours ?? 0) }

  const reservedDetail = [...ctx.reserved]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map(r => {
      const type = balanceTypeFor(r.leave_type)!
      const proj = projectedAvailable({ type, onDate: r.start_date, current: current[type], reserved: ctx.reserved.filter(x => x.id !== r.id), hireDate: ctx.hireDate, ptoUncapped: ctx.ptoUncapped, accrualsOn: ctx.accrualsOn })
      return { ...r, projectedBefore: proj.projected, covered: proj.projected >= r.hours }
    })
  return { hireDate: ctx.hireDate, ptoUncapped: ctx.ptoUncapped, accrualsOn: ctx.accrualsOn, reserved: ctx.reserved, reservedDetail }
}
