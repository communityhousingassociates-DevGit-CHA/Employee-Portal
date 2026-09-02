'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
import { distributeLeaveHours, applyLeaveToTimesheets } from '@/lib/leave-timesheet'
import type { LeaveType, Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

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
}) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { error } = await admin.from('leave_requests').insert({
    employee_id: employee.id,
    leave_type: data.leave_type,
    start_date: data.start_date,
    end_date: data.end_date,
    hours: data.hours,
    note: data.note || null,
    status: 'pending',
    employee_signed_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/request')
  revalidatePath('/history')
  revalidatePath('/dashboard')
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
  await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leave_requests')
    .select('*, employee:employees!leave_requests_employee_id_fkey(name, avatar_url)')
    .eq('status', 'pending')
    .order('created_at')
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
  await requireRole(MANAGER_ROLES)
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
  const actor = await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()

  const { data: request, error: fetchError } = await admin.from('leave_requests').select('*').eq('id', id).single()
  if (fetchError) throw new Error(fetchError.message)
  if (request.status !== 'pending') throw new Error('This request has already been decided')

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
  await applyLeaveToTimesheets(admin, request.employee_id, request.leave_type as LeaveType, allocations)

  revalidatePath('/approvals')
  revalidatePath('/history')
  revalidatePath('/dashboard')
  revalidatePath('/timesheet')
}

export async function denyLeaveRequest(id: string, reason: string) {
  const actor = await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { data: request, error: fetchError } = await admin.from('leave_requests').select('status').eq('id', id).single()
  if (fetchError) throw new Error(fetchError.message)
  if (request.status !== 'pending') throw new Error('This request has already been decided')

  const { error } = await admin.from('leave_requests').update({
    status: 'denied',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
    approver_signed_at: new Date().toISOString(),
    deny_reason: reason || null,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/approvals')
  revalidatePath('/history')
  revalidatePath('/dashboard')
}
