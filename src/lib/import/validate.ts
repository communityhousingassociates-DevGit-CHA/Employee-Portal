import { calcTier, SICK_RATE_PER_PERIOD, PTO_CARRYOVER_CAP } from '@/lib/constants/accrual'
import { EXAMPLE_ROW_MARKER } from './employee-parser'
import { SALARY_EXAMPLE_ROW_MARKER } from './salary-parser'
import { buildFullName } from '@/lib/format-name'
import type { ParsedEmployeeRow, ParsedBalanceRow, ParsedSalaryRow, RowIssue, PreviewRow, ImportPreview, ExistingEmployee } from './types'

const VALID_EMPLOYEE_TYPES = ['full-time', 'part-time', 'consultant']
const VALID_ROLES = ['employee', 'accounting_manager', 'ceo', 'admin']
const VALID_STAFF_CATEGORIES = ['cha_employee', 'resident_advocate']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_MATCH_TOLERANCE = 0.01

function worstStatus(issues: RowIssue[]): 'ok' | 'warning' | 'error' {
  if (issues.some(i => i.severity === 'error')) return 'error'
  if (issues.some(i => i.severity === 'warning')) return 'warning'
  return 'ok'
}

export function validateEmployeeRows(
  rows: ParsedEmployeeRow[],
  existingEmails: Set<string>
): PreviewRow<ParsedEmployeeRow>[] {
  const seenInSheet = new Map<string, number>() // lowercased email -> first rowIndex seen

  return rows.map(row => {
    const issues: RowIssue[] = []
    const emailLower = row.email.toLowerCase()

    if (row.first_name.includes(EXAMPLE_ROW_MARKER) || row.last_name.includes(EXAMPLE_ROW_MARKER)) {
      issues.push({ severity: 'error', field: 'name', message: 'Unedited example row — delete before re-uploading', rowIndex: row.rowIndex })
    }
    if (!row.first_name) {
      issues.push({ severity: 'error', field: 'first_name', message: 'Missing first name', rowIndex: row.rowIndex })
    }
    if (!row.last_name) {
      issues.push({ severity: 'error', field: 'last_name', message: 'Missing last name', rowIndex: row.rowIndex })
    }
    if (!row.email) {
      issues.push({ severity: 'error', field: 'email', message: 'Missing email', rowIndex: row.rowIndex })
    } else if (!EMAIL_RE.test(row.email)) {
      issues.push({ severity: 'error', field: 'email', message: `Malformed email: "${row.email}"`, rowIndex: row.rowIndex })
    } else {
      if (seenInSheet.has(emailLower)) {
        issues.push({ severity: 'error', field: 'email', message: `Duplicate email within this sheet (also row ${seenInSheet.get(emailLower)! + 1})`, rowIndex: row.rowIndex })
      } else {
        seenInSheet.set(emailLower, row.rowIndex)
      }
      if (existingEmails.has(emailLower)) {
        issues.push({ severity: 'error', field: 'email', message: 'An employee with this email already exists in the portal', rowIndex: row.rowIndex })
      }
    }
    if (!row.hire_date || Number.isNaN(new Date(row.hire_date).getTime())) {
      issues.push({ severity: 'error', field: 'hire_date', message: 'Missing or unparseable hire date', rowIndex: row.rowIndex })
    }
    if (!VALID_EMPLOYEE_TYPES.includes(row.employee_type)) {
      issues.push({ severity: 'error', field: 'employee_type', message: `Invalid employee type: "${row.employee_type}" (expected ${VALID_EMPLOYEE_TYPES.join(', ')})`, rowIndex: row.rowIndex })
    }
    if (!VALID_ROLES.includes(row.role)) {
      issues.push({ severity: 'error', field: 'role', message: `Invalid role: "${row.role}" (expected ${VALID_ROLES.join(', ')})`, rowIndex: row.rowIndex })
    }
    if (!VALID_STAFF_CATEGORIES.includes(row.staff_category)) {
      issues.push({ severity: 'error', field: 'staff_category', message: `Invalid staff category: "${row.staff_category}" (expected ${VALID_STAFF_CATEGORIES.join(', ')}, or leave blank for cha_employee)`, rowIndex: row.rowIndex })
    }

    return { data: row, issues, status: worstStatus(issues) }
  })
}

export function validateBalanceRows(
  rows: ParsedBalanceRow[],
  employeeRows: ParsedEmployeeRow[],
  existingEmployees: ExistingEmployee[]
): PreviewRow<ParsedBalanceRow & { matchedEmail: string | null }>[] {
  const byNameLower = new Map<string, string[]>() // lowercased name -> matching emails

  // Registers the full "First M. Last" key, plus — when a middle initial is
  // present — a bare "First Last" key too. The Validation sheet's Employee
  // Name column is free text and its own Instructions never mention needing
  // a middle initial, so a row that omits one (very likely) still matches
  // instead of silently failing with "no employee found".
  function register(first: string, last: string, middleInitial: string | null, email: string) {
    const full = buildFullName(first, last, middleInitial).toLowerCase()
    byNameLower.set(full, [...(byNameLower.get(full) ?? []), email])
    if (middleInitial) {
      const bare = buildFullName(first, last, null).toLowerCase()
      if (bare !== full) byNameLower.set(bare, [...(byNameLower.get(bare) ?? []), email])
    }
  }

  for (const e of employeeRows) {
    if (!e.first_name || !e.last_name || !e.email) continue
    register(e.first_name, e.last_name, e.middle_initial, e.email)
  }
  for (const e of existingEmployees) {
    register(e.first_name, e.last_name, e.middle_initial, e.email)
  }

  return rows.map(row => {
    const issues: RowIssue[] = []
    const matches = byNameLower.get(row.name.trim().toLowerCase()) ?? []
    let matchedEmail: string | null = null

    if (!row.name) {
      issues.push({ severity: 'error', field: 'name', message: 'Missing employee name', rowIndex: row.rowIndex })
    } else if (matches.length === 0) {
      issues.push({ severity: 'error', field: 'name', message: `No employee named "${row.name}" found in the intake sheet or existing roster`, rowIndex: row.rowIndex })
    } else if (matches.length > 1) {
      issues.push({ severity: 'error', field: 'name', message: `"${row.name}" matches more than one employee — make names unique and re-upload`, rowIndex: row.rowIndex })
    } else {
      matchedEmail = matches[0]
    }

    if (row.hireDate) {
      const { ptoRate } = calcTier(row.hireDate)
      if (row.chaPtoRate !== null && Math.abs(row.chaPtoRate - ptoRate) > RATE_MATCH_TOLERANCE) {
        issues.push({ severity: 'warning', field: 'chaPtoRate', message: `CHA's stated PTO rate (${row.chaPtoRate}/period) doesn't match the portal's computed rate (${ptoRate}/period) for this tenure`, rowIndex: row.rowIndex })
      }
    }
    if (row.chaSickRate !== null && Math.abs(row.chaSickRate - SICK_RATE_PER_PERIOD) > RATE_MATCH_TOLERANCE) {
      issues.push({ severity: 'warning', field: 'chaSickRate', message: `CHA's stated sick rate (${row.chaSickRate}/period) doesn't match the portal's fixed rate (${SICK_RATE_PER_PERIOD}/period)`, rowIndex: row.rowIndex })
    }

    for (const [field, label, value] of [
      ['ptoBalance', 'PTO', row.ptoBalance],
      ['sickBalance', 'Sick', row.sickBalance],
      ['personalBalance', 'Personal', row.personalBalance],
    ] as const) {
      if (value === null) {
        issues.push({ severity: 'warning', field, message: `${label} balance not filled in — will be seeded as 0`, rowIndex: row.rowIndex })
      } else if (value < 0) {
        issues.push({ severity: 'error', field, message: `${label} balance cannot be negative (${value})`, rowIndex: row.rowIndex })
      }
    }
    if (row.ptoBalance !== null && row.ptoBalance > PTO_CARRYOVER_CAP) {
      issues.push({ severity: 'warning', field: 'ptoBalance', message: `PTO balance (${row.ptoBalance}) exceeds the ${PTO_CARRYOVER_CAP}hr carryover cap — confirm with CHA before seeding as-is`, rowIndex: row.rowIndex })
    }

    return { data: { ...row, matchedEmail }, issues, status: worstStatus(issues) }
  })
}

export function validateSalaryRows(
  rows: ParsedSalaryRow[],
  employeeRows: ParsedEmployeeRow[],
  existingEmployees: ExistingEmployee[]
): PreviewRow<ParsedSalaryRow & { matchedEmail: string | null }>[] {
  const knownEmails = new Set([
    ...employeeRows.map(e => e.email.toLowerCase()),
    ...existingEmployees.map(e => e.email.toLowerCase()),
  ])
  const seenInSheet = new Map<string, number>()

  return rows.map(row => {
    const issues: RowIssue[] = []
    let matchedEmail: string | null = null

    if (row.name.includes(SALARY_EXAMPLE_ROW_MARKER)) {
      issues.push({ severity: 'error', field: 'name', message: 'Unedited example row — delete before re-uploading', rowIndex: row.rowIndex })
    }
    if (!row.email) {
      issues.push({ severity: 'error', field: 'email', message: 'Missing employee email', rowIndex: row.rowIndex })
    } else if (!knownEmails.has(row.email)) {
      issues.push({ severity: 'error', field: 'email', message: `No employee with email "${row.email}" found in the intake sheet or existing roster`, rowIndex: row.rowIndex })
    } else if (seenInSheet.has(row.email)) {
      issues.push({ severity: 'error', field: 'email', message: `Duplicate email within this sheet (also row ${seenInSheet.get(row.email)! + 1})`, rowIndex: row.rowIndex })
    } else {
      seenInSheet.set(row.email, row.rowIndex)
      matchedEmail = row.email
    }

    if (row.annualSalary === null) {
      issues.push({ severity: 'error', field: 'annualSalary', message: 'Missing annual salary', rowIndex: row.rowIndex })
    } else if (row.annualSalary <= 0) {
      issues.push({ severity: 'error', field: 'annualSalary', message: `Annual salary must be greater than 0 (got ${row.annualSalary})`, rowIndex: row.rowIndex })
    }

    if (!row.effectiveDate || Number.isNaN(new Date(row.effectiveDate).getTime())) {
      issues.push({ severity: 'error', field: 'effectiveDate', message: 'Missing or unparseable effective date', rowIndex: row.rowIndex })
    }

    return { data: { ...row, matchedEmail }, issues, status: worstStatus(issues) }
  })
}

export function buildPreview(
  employeeRows: ParsedEmployeeRow[],
  balanceRows: ParsedBalanceRow[],
  existingEmployees: ExistingEmployee[],
  salaryRows: ParsedSalaryRow[] = []
): ImportPreview {
  const existingEmails = new Set(existingEmployees.map(e => e.email.toLowerCase()))
  const employees = validateEmployeeRows(employeeRows, existingEmails)
  const balances = validateBalanceRows(balanceRows, employeeRows, existingEmployees)
  const salaries = validateSalaryRows(salaryRows, employeeRows, existingEmployees)

  const allStatuses = [...employees.map(r => r.status), ...balances.map(r => r.status), ...salaries.map(r => r.status)]
  const summary = {
    ready: allStatuses.filter(s => s === 'ok').length,
    warnings: allStatuses.filter(s => s === 'warning').length,
    errors: allStatuses.filter(s => s === 'error').length,
  }

  return { employees, balances, salaries, summary }
}
