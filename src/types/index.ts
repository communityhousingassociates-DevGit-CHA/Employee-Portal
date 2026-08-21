export type Role = 'employee' | 'accounting_manager' | 'ceo' | 'admin'
export type LeaveStatus = 'pending' | 'approved' | 'denied'
export type LeaveType = 'PTO' | 'Sick' | 'Personal' | 'Bereavement' | 'Jury Duty'
export type EmployeeType = 'full-time' | 'part-time' | 'consultant'
export type StaffCategory = 'cha_employee' | 'resident_advocate'
export type TimesheetStatus = 'draft' | 'submitted' | 'approved'
export type ExpenseCategory = 'mileage' | 'hotel' | 'airline' | 'meals' | 'entertainment' | 'other'
export type ExpenseStatus = 'pending' | 'approved' | 'denied'

// DB-shaped types — mirror supabase-schema.sql columns exactly.

export interface Employee {
  id: string
  user_id: string | null
  employee_number: number
  first_name: string
  last_name: string
  middle_initial: string | null
  name: string // generated column — read-only, don't write it directly
  email: string
  role: Role
  employee_type: EmployeeType
  staff_category: StaffCategory
  is_super_admin: boolean
  department: string | null
  job_title: string | null
  hire_date: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  avatar_url: string | null
  grant_id: string | null
  is_active: boolean
  created_at: string
}

export interface Grant {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface EmployeeSalary {
  id: string
  employee_id: string
  annual_salary: number
  effective_date: string
  note: string | null
  created_by: string | null
  created_at: string
}

export interface MileageRate {
  id: string
  year: number
  rate_per_mile: number
  updated_at: string
  updated_by: string | null
}

export interface Expense {
  id: string
  employee_id: string
  category: ExpenseCategory
  expense_date: string
  description: string | null
  miles: number | null
  rate_per_mile: number | null
  amount: number
  receipt_url: string | null
  grant_id: string | null
  status: ExpenseStatus
  approver_id: string | null
  approved_at: string | null
  deny_reason: string | null
  created_at: string
}

export interface LeaveBalance {
  id: string
  employee_id: string
  pto_hours: number
  sick_hours: number
  personal_hours: number
  updated_at: string
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  hours: number
  note: string | null
  deny_reason: string | null
  status: LeaveStatus
  approver_id: string | null
  approved_at: string | null
  employee_signed_at: string | null
  approver_signed_at: string | null
  created_at: string
}

export interface Timesheet {
  id: string
  employee_id: string
  period_start: string
  period_end: string
  status: TimesheetStatus
  employee_signed_at: string | null
  approver_id: string | null
  approved_at: string | null
  created_at: string
}

export interface TimesheetRow {
  id: string
  timesheet_id: string
  work_date: string
  description: string | null
  regular_hours: number
  leave_hours: number
  leave_type: LeaveType | null
}

export interface AccrualLogEntry {
  id: string
  employee_id: string
  accrual_type: 'pto' | 'sick'
  hours: number
  period_start: string
  created_at: string
}
