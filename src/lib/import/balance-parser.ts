import * as XLSX from 'xlsx'
import type { ParsedBalanceRow } from './types'

const SHEET_NAME = 'Validation'
const FIRST_DATA_ROW = 13 // 0-based index into the array-of-arrays; row 14 in the spreadsheet (header is row 13)

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

export async function parseBalanceWorkbook(buffer: ArrayBuffer): Promise<ParsedBalanceRow[]> {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[SHEET_NAME]
  if (!ws) {
    throw new Error(`Sheet "${SHEET_NAME}" not found — is this the right file?`)
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

  const parsed: ParsedBalanceRow[] = []
  for (let i = FIRST_DATA_ROW; i < rows.length; i++) {
    const row = rows[i] ?? []
    // A name, B hireDate, F chaPtoRate, H chaSickRate, J ptoBalance, L sickBalance, M personalBalance, N notes
    const [name, hireDate, , , , chaPtoRate, , chaSickRate, , ptoBalance, , sickBalance, personalBalance, notes] = row

    if (row.every(v => cell(v) === null)) continue

    parsed.push({
      rowIndex: i,
      name: cell(name) ?? '',
      hireDate: cell(hireDate),
      chaPtoRate: num(chaPtoRate),
      chaSickRate: num(chaSickRate),
      ptoBalance: num(ptoBalance),
      sickBalance: num(sickBalance),
      personalBalance: num(personalBalance),
      notes: cell(notes),
    })
  }
  return parsed
}
