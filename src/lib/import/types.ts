export interface ExistingEmployee {
  name: string
  email: string
  first_name: string
  last_name: string
  middle_initial: string | null
}

export interface RowIssue {
  severity: 'error' | 'warning'
  field: string
  message: string
  rowIndex: number // 0-based index into the parsed rows array
}

export interface ParsedEmployeeRow {
  rowIndex: number
  first_name: string
  last_name: string
  middle_initial: string | null
  email: string
  employee_type: string
  role: string
  staff_category: string
  department: string | null
  job_title: string | null
  hire_date: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
}

export interface ParsedBalanceRow {
  rowIndex: number
  name: string
  hireDate: string | null
  chaPtoRate: number | null
  chaSickRate: number | null
  ptoBalance: number | null
  sickBalance: number | null
  personalBalance: number | null
  notes: string | null
}

export interface ParsedSalaryRow {
  rowIndex: number
  email: string
  name: string
  annualSalary: number | null
  effectiveDate: string | null
  note: string | null
}

export interface PreviewRow<T> {
  data: T
  issues: RowIssue[]
  status: 'ok' | 'warning' | 'error'
}

export interface ImportPreview {
  employees: PreviewRow<ParsedEmployeeRow>[]
  balances: PreviewRow<ParsedBalanceRow & { matchedEmail: string | null }>[]
  salaries: PreviewRow<ParsedSalaryRow & { matchedEmail: string | null }>[]
  summary: { ready: number; warnings: number; errors: number }
}

export interface ConfirmedImportPayload {
  employees: ParsedEmployeeRow[]
  balances: (ParsedBalanceRow & { matchedEmail: string })[]
}
