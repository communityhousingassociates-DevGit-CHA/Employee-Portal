import * as XLSX from 'xlsx'
import { parseBalanceWorkbook } from './balance-parser'

export type BalanceFileRow = {
  rowIndex: number
  name: string
  email: string | null
  pto: number | null
  sick: number | null
  vacation: number | null
}

const norm = (v: unknown) => String(v ?? '').trim()
const numOrNull = (v: unknown) => {
  const s = norm(v).replace(/,/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Reads a leave-balance file in either format:
 *   1. CHA's "Leave Balance Validation" template (the workbook the portal generated — has a "Validation" sheet), or
 *   2. any sheet/CSV with a header row containing a Name and/or Email column plus PTO, Sick, and Vacation (or
 *      Personal) balance columns.
 */
export async function parseBalanceUpdateFile(buffer: ArrayBuffer): Promise<BalanceFileRow[]> {
  const wb = XLSX.read(buffer, { type: 'array' })

  if (wb.Sheets['Validation']) {
    const rows = await parseBalanceWorkbook(buffer)
    return rows.map(r => ({ rowIndex: r.rowIndex, name: r.name, email: null, pto: r.ptoBalance, sick: r.sickBalance, vacation: r.personalBalance }))
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('The file has no sheets')
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false })

  // Find the header row: the first one that names a person column and at least two of the three balances.
  for (let h = 0; h < Math.min(grid.length, 30); h++) {
    const headers = (grid[h] ?? []).map(c => norm(c).toLowerCase())
    const col = (re: RegExp) => headers.findIndex(x => re.test(x))
    const nameCol = col(/^(employee\s*)?name$|^employee$/)
    const emailCol = col(/e-?mail/)
    const ptoCol = col(/\bpto\b/)
    const sickCol = col(/sick/)
    const vacCol = col(/vacation|personal/)
    const balanceCols = [ptoCol, sickCol, vacCol].filter(c => c >= 0).length
    if ((nameCol < 0 && emailCol < 0) || balanceCols < 2) continue

    const out: BalanceFileRow[] = []
    for (let i = h + 1; i < grid.length; i++) {
      const row = grid[i] ?? []
      if (row.every(v => norm(v) === '')) continue
      out.push({
        rowIndex: i,
        name: nameCol >= 0 ? norm(row[nameCol]) : '',
        email: emailCol >= 0 ? norm(row[emailCol]).toLowerCase() || null : null,
        pto: ptoCol >= 0 ? numOrNull(row[ptoCol]) : null,
        sick: sickCol >= 0 ? numOrNull(row[sickCol]) : null,
        vacation: vacCol >= 0 ? numOrNull(row[vacCol]) : null,
      })
    }
    return out
  }
  throw new Error('Couldn’t find a header row with a Name or Email column and PTO / Sick / Vacation balance columns')
}

/**
 * The "As Of Date" typed into the top of CHA's Leave Balance Validation workbook (cell B2 of the Validation sheet),
 * or null if the file isn't that template or the cell is blank / not a date. Used to pre-fill — never to replace — the
 * as-of date a person must confirm.
 */
export function readTemplateAsOf(buffer: ArrayBuffer): string | null {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets['Validation']
  if (!ws) return null
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })
  const v = String(grid[1]?.[1] ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
