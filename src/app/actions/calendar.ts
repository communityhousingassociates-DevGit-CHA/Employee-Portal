'use server'

import { UserError } from '@/lib/user-error'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayET } from '@/lib/pay-periods'
import { getCurrentEmployee } from '@/lib/auth/session'
import { loadRequestDays } from '@/lib/leave-timesheet'
import { getTestAccountIds } from '@/lib/test-accounts'

export async function getLeaveEventsInRange(startIso: string, endIso: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new UserError('Forbidden')
  const admin = createAdminClient()
  let query = admin
    .from('leave_requests')
    .select('id, employee_id, leave_type, start_date, end_date, hours, status, employee:employees!leave_requests_employee_id_fkey(name)')
    .in('status', ['approved', 'pending'])
    .lte('start_date', endIso)
    .gte('end_date', startIso)
  // Test accounts (workflow testing) never show up on the shared team calendar for real staff.
  if (!employee.is_test_account) {
    const testIds = await getTestAccountIds(admin)
    if (testIds.size) query = query.not('employee_id', 'in', `(${[...testIds].join(',')})`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  // The calendar shows only the days actually requested off, not the whole span of the request.
  const daysByRequest = await loadRequestDays(admin, data ?? [])
  return (data ?? []).map(r => {
    const emp = r.employee as unknown as { name: string } | { name: string }[]
    const name = Array.isArray(emp) ? emp[0]?.name : emp?.name
    return {
      dates: (daysByRequest.get(r.id) ?? []).map(d => d.date),
      id: r.id,
      employee_id: r.employee_id,
      leave_type: r.leave_type,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
      employee_name: name ?? 'Unknown',
      mine: r.employee_id === employee.id,
    }
  })
}

export async function getUpcomingLeave(limit = 10) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new UserError('Forbidden')
  const admin = createAdminClient()
  const today = todayET()
  let query = admin
    .from('leave_requests')
    .select('id, employee_id, leave_type, start_date, end_date, hours, status, employee:employees!leave_requests_employee_id_fkey(name)')
    .in('status', ['approved', 'pending'])
    .gte('end_date', today)
    .order('start_date')
    .limit(limit)
  if (!employee.is_test_account) {
    const testIds = await getTestAccountIds(admin)
    if (testIds.size) query = query.not('employee_id', 'in', `(${[...testIds].join(',')})`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const daysByRequest = await loadRequestDays(admin, data ?? [])
  return (data ?? []).map(r => {
    const emp = r.employee as unknown as { name: string } | { name: string }[]
    const name = Array.isArray(emp) ? emp[0]?.name : emp?.name
    return {
      dates: (daysByRequest.get(r.id) ?? []).map(d => d.date),
      id: r.id,
      leave_type: r.leave_type,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
      employee_name: name ?? 'Unknown',
      mine: r.employee_id === employee.id,
    }
  })
}
