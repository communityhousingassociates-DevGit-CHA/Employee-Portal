'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'

export async function getLeaveEventsInRange(startIso: string, endIso: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leave_requests')
    .select('id, employee_id, leave_type, start_date, end_date, status, employee:employees!leave_requests_employee_id_fkey(name)')
    .in('status', ['approved', 'pending'])
    .lte('start_date', endIso)
    .gte('end_date', startIso)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => {
    const emp = r.employee as unknown as { name: string } | { name: string }[]
    const name = Array.isArray(emp) ? emp[0]?.name : emp?.name
    return {
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
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin
    .from('leave_requests')
    .select('id, employee_id, leave_type, start_date, end_date, status, employee:employees!leave_requests_employee_id_fkey(name)')
    .in('status', ['approved', 'pending'])
    .gte('end_date', today)
    .order('start_date')
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => {
    const emp = r.employee as unknown as { name: string } | { name: string }[]
    const name = Array.isArray(emp) ? emp[0]?.name : emp?.name
    return {
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
