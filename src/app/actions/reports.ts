'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { calcTier } from '@/lib/constants/accrual'
import type { Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

export async function getReportSummary(periodStart: string, periodEnd: string) {
  const me = await getCurrentEmployee()
  if (!me) throw new Error('Forbidden')
  const isManager = MANAGER_ROLES.includes(me.role)
  const admin = createAdminClient()

  const { data: employees, error: empError } = await admin
    .from('employees')
    .select('id, name, hire_date')
    .eq('is_active', true)
    .order('name')
  if (empError) throw new Error(empError.message)

  const targetEmployees = isManager ? (employees ?? []) : (employees ?? []).filter(e => e.id === me.id)
  const employeeIds = targetEmployees.map(e => e.id)
  if (employeeIds.length === 0) return { leaveRows: [], timesheetRows: [], expenseRows: [], isManager }

  const [{ data: balances }, { data: leaveRequests }, { data: timesheets }, { data: expenses }, { data: salaries }] = await Promise.all([
    admin.from('leave_balances').select('*').in('employee_id', employeeIds),
    admin.from('leave_requests').select('*').in('employee_id', employeeIds).eq('status', 'approved').lte('start_date', periodEnd).gte('end_date', periodStart),
    admin.from('timesheets').select('*, timesheet_rows(regular_hours, leave_hours)').in('employee_id', employeeIds).eq('period_start', periodStart),
    admin.from('expenses').select('*').in('employee_id', employeeIds).gte('expense_date', periodStart).lte('expense_date', periodEnd),
    admin.from('employee_current_salary').select('employee_id, annual_salary').in('employee_id', employeeIds),
  ])

  // Weekly gross = annual salary ÷ 52. Scoped to the same self-or-manager
  // employee set as everything else here — never fetched beyond that.
  const salaryByEmployee = new Map((salaries ?? []).map(s => [s.employee_id, Number(s.annual_salary)]))

  const balanceByEmployee = new Map((balances ?? []).map(b => [b.employee_id, b]))
  const leaveByEmployee = new Map<string, typeof leaveRequests>()
  for (const r of leaveRequests ?? []) {
    const list = leaveByEmployee.get(r.employee_id) ?? []
    list.push(r)
    leaveByEmployee.set(r.employee_id, list)
  }
  const timesheetByEmployee = new Map((timesheets ?? []).map(t => [t.employee_id, t]))
  const expensesByEmployee = new Map<string, typeof expenses>()
  for (const e of expenses ?? []) {
    const list = expensesByEmployee.get(e.employee_id) ?? []
    list.push(e)
    expensesByEmployee.set(e.employee_id, list)
  }

  const leaveRows = targetEmployees.map(emp => {
    const bal = balanceByEmployee.get(emp.id)
    const requests = leaveByEmployee.get(emp.id) ?? []
    const sumFor = (type: string) => requests.filter(r => r.leave_type === type).reduce((s, r) => s + Number(r.hours), 0)
    return {
      id: emp.id,
      name: emp.name,
      pto_used: sumFor('PTO'),
      sick_used: sumFor('Sick'),
      personal_used: sumFor('Personal'),
      pto_bal: bal ? Number(bal.pto_hours) : 0,
      sick_bal: bal ? Number(bal.sick_hours) : 0,
      personal_bal: bal ? Number(bal.personal_hours) : 0,
      accrual: calcTier(emp.hire_date).ptoRate,
    }
  })

  const timesheetRows = targetEmployees.map(emp => {
    const ts = timesheetByEmployee.get(emp.id)
    const rows = (ts?.timesheet_rows ?? []) as { regular_hours: number; leave_hours: number }[]
    const reg_hours = rows.reduce((s, r) => s + Number(r.regular_hours), 0)
    const leave_hours = rows.reduce((s, r) => s + Number(r.leave_hours), 0)
    const annual_salary = salaryByEmployee.get(emp.id) ?? null
    const weekly_gross = annual_salary !== null ? annual_salary / 52 : null
    return { id: emp.id, name: emp.name, reg_hours, leave_hours, status: ts?.status ?? 'draft', annual_salary, weekly_gross }
  })

  const expenseRows = targetEmployees.map(emp => {
    const items = expensesByEmployee.get(emp.id) ?? []
    const total = items.reduce((s, e) => s + Number(e.amount), 0)
    const byCategory: Record<string, number> = {}
    for (const e of items) byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount)
    return { id: emp.id, name: emp.name, total, count: items.length, byCategory }
  })

  return { leaveRows, timesheetRows, expenseRows, isManager }
}
