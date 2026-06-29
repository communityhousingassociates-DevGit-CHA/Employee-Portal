export type Role = 'employee' | 'accounting_manager' | 'ceo' | 'admin'
export type LeaveStatus = 'pending' | 'approved' | 'denied'
export type LeaveType = 'PTO' | 'Sick' | 'Personal' | 'Bereavement' | 'Jury Duty'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  hire_date: string
  avatar: string
}

export interface LeaveRequest {
  id: string
  type: LeaveType
  start: string
  end: string
  hours: number
  submitted: string
  status: LeaveStatus
  approved_by: string | null
  note?: string
}

export interface LeaveBalance {
  pto: { available: number; cap: number; accrual: number }
  sick: { available: number; cap: number | null; accrual: number }
  personal: { available: number; cap: number; used: number }
}
