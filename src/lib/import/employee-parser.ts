import * as XLSX from 'xlsx'
import type { ParsedEmployeeRow } from './types'

const SHEET_NAME = 'Employee Data'
const FIRST_DATA_ROW = 1 // 0-based index into the array-of-arrays; row 2 in the spreadsheet — the example row itself, so it gets parsed and flagged rather than silently skipped
export const EXAMPLE_ROW_MARKER = 'EXAMPLE — delete this row'

function cell(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export async function parseEmployeeWorkbook(buffer: ArrayBuffer): Promise<ParsedEmployeeRow[]> {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[SHEET_NAME]
  if (!ws) {
    throw new Error(`Sheet "${SHEET_NAME}" not found — is this the right file?`)
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

  const parsed: ParsedEmployeeRow[] = []
  for (let i = FIRST_DATA_ROW; i < rows.length; i++) {
    const row = rows[i] ?? []
    const [first_name, last_name, middle_initial, email, employee_type, role, department, job_title, hire_date, address_line1, address_line2, city, state, postal_code, staffCategoryRaw] = row

    // Fully blank row (trailing template rows) — skip silently.
    if (row.every(v => cell(v) === null)) continue

    parsed.push({
      rowIndex: i,
      first_name: cell(first_name) ?? '',
      last_name: cell(last_name) ?? '',
      middle_initial: cell(middle_initial),
      email: cell(email) ?? '',
      employee_type: (cell(employee_type) ?? '').toLowerCase(),
      role: (cell(role) ?? '').toLowerCase(),
      // Blank defaults to a regular CHA employee — only Resident Advocate rows need to fill this in.
      staff_category: (cell(staffCategoryRaw) ?? 'cha_employee').toLowerCase().replace(/\s+/g, '_'),
      department: cell(department),
      job_title: cell(job_title),
      hire_date: cell(hire_date),
      address_line1: cell(address_line1),
      address_line2: cell(address_line2),
      city: cell(city),
      state: cell(state),
      postal_code: cell(postal_code),
    })
  }
  return parsed
}
