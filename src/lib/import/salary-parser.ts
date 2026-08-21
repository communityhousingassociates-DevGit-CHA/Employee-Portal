import * as XLSX from 'xlsx'
import type { ParsedSalaryRow } from './types'

const SHEET_NAME = 'Salary Data'
const FIRST_DATA_ROW = 1 // 0-based index; row 2 in the spreadsheet — the example row itself, so it gets parsed and flagged rather than silently skipped
export const SALARY_EXAMPLE_ROW_MARKER = 'EXAMPLE — delete this row'

function cell(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function num(v: unknown): number | null {
  const s = cell(v)
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export async function parseSalaryWorkbook(buffer: ArrayBuffer): Promise<ParsedSalaryRow[]> {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[SHEET_NAME]
  if (!ws) {
    throw new Error(`Sheet "${SHEET_NAME}" not found — is this the right file?`)
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

  const parsed: ParsedSalaryRow[] = []
  for (let i = FIRST_DATA_ROW; i < rows.length; i++) {
    const row = rows[i] ?? []
    const [email, name, annualSalary, effectiveDate, note] = row

    if (row.every(v => cell(v) === null)) continue

    parsed.push({
      rowIndex: i,
      email: (cell(email) ?? '').toLowerCase(),
      name: cell(name) ?? '',
      annualSalary: num(annualSalary),
      effectiveDate: cell(effectiveDate),
      note: cell(note),
    })
  }
  return parsed
}
