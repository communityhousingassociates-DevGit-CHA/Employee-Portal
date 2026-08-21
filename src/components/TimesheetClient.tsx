'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getOrCreateTimesheet, saveTimesheetDraft, submitTimesheet } from '@/app/actions/timesheets'
import { getExpensesForPeriod } from '@/app/actions/expenses'
import { formatEmployeeId } from '@/lib/constants/employee-id'
import type { Timesheet, TimesheetRow as TimesheetRowType, Expense } from '@/types'
import type { PayPeriod } from '@/lib/pay-periods'

const TARGET_HOURS = 80

type EditableRow = TimesheetRowType & { dirty?: boolean }
type Salary = { annual_salary: number; effective_date: string; note: string | null } | null

const currency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function addDays(d: string, days: number): string {
  const date = new Date(`${d}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatShort(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatPeriodLabel(p: PayPeriod): string {
  return `${new Date(`${p.start}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(`${p.end}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export default function TimesheetClient({
  employeeName,
  employeeNumber,
  periods,
  initialTimesheet,
  initialRows,
  initialExpenses,
  salary,
}: {
  employeeName: string
  employeeNumber: number
  periods: PayPeriod[]
  initialTimesheet: Timesheet
  initialRows: TimesheetRowType[]
  initialExpenses: Expense[]
  salary: Salary
}) {
  const [periodIdx, setPeriodIdx] = useState(0)
  const [timesheet, setTimesheet] = useState<Timesheet>(initialTimesheet)
  const [rows, setRows] = useState<EditableRow[]>(initialRows)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [loading, setLoading] = useState(false)
  const [signed, setSigned] = useState(false)
  const [savedDraft, setSavedDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const period = periods[periodIdx]
  const dueDate = addDays(period.end, 2)
  const submitted = timesheet.status === 'submitted' || timesheet.status === 'approved'

  const totalReg = rows.reduce((s, r) => s + Number(r.regular_hours), 0)
  const totalLeave = rows.reduce((s, r) => s + Number(r.leave_hours), 0)
  const total = totalReg + totalLeave
  const pct = Math.min(Math.round((total / TARGET_HOURS) * 100), 100)
  const remaining = Math.max(TARGET_HOURS - total, 0)
  const over = total > TARGET_HOURS

  const employeeIdLabel = formatEmployeeId(employeeNumber)
  const weeklyGross = salary ? Number(salary.annual_salary) / 52 : null
  const periodGross = weeklyGross !== null ? weeklyGross * 2 : null

  async function switchPeriod(newIdx: number) {
    if (newIdx < 0 || newIdx >= periods.length || newIdx === periodIdx) return
    setLoading(true)
    setError('')
    setSigned(false)
    try {
      const p = periods[newIdx]
      const [{ timesheet: ts, rows: r }, exp] = await Promise.all([
        getOrCreateTimesheet(p.start, p.end),
        getExpensesForPeriod(timesheet.employee_id, p.start, p.end).catch(() => []),
      ])
      setPeriodIdx(newIdx)
      setTimesheet(ts)
      setRows(r)
      setExpenses(exp)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load period')
    } finally {
      setLoading(false)
    }
  }

  function updateRow(id: string, patch: Partial<EditableRow>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch, dirty: true } : r))
  }

  async function saveDraft() {
    setError('')
    try {
      await saveTimesheetDraft(timesheet.id, rows.map(r => ({
        id: r.id,
        description: r.description,
        regular_hours: Number(r.regular_hours),
        leave_hours: Number(r.leave_hours),
      })))
      setSavedDraft(true)
      setTimeout(() => setSavedDraft(false), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save draft')
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      await saveTimesheetDraft(timesheet.id, rows.map(r => ({
        id: r.id,
        description: r.description,
        regular_hours: Number(r.regular_hours),
        leave_hours: Number(r.leave_hours),
      })))
      await submitTimesheet(timesheet.id)
      setTimesheet(t => ({ ...t, status: 'submitted' }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit timesheet')
    } finally {
      setSubmitting(false)
    }
  }

  function exportCsv() {
    const headers = ['Employee', 'Employee ID', 'Date', 'Description', 'Regular Hours', 'Leave Hours', 'Total Hours']
    const csvRows = rows.map(r => [employeeName, employeeIdLabel, r.work_date, r.description || '', r.regular_hours, r.leave_hours, Number(r.regular_hours) + Number(r.leave_hours)])
    csvRows.push([employeeName, employeeIdLabel, '', 'Totals', totalReg, totalLeave, total])
    if (weeklyGross !== null && periodGross !== null) {
      csvRows.push([employeeName, employeeIdLabel, '', 'Weekly Gross Wages', '', '', weeklyGross.toFixed(2)])
      csvRows.push([employeeName, employeeIdLabel, '', 'Pay Period Gross Wages', '', '', periodGross.toFixed(2)])
    }
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CHA-Timesheet-${employeeName.replace(/\s+/g, '-')}-${period.start}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (submitted && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✅</div>
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-2">Timesheet Submitted</h2>
          <p className="text-[13px] text-gray-500 mb-1">{formatPeriodLabel(period)}</p>
          <p className="text-[13px] text-gray-500 mb-5">Sent for approval. You&apos;ll be notified when it&apos;s reviewed.</p>
          <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-xl p-4 text-left text-[12px] text-gray-500 mb-5">
            <div className="flex justify-between mb-1"><span>Regular hours</span><strong className="text-[#0b2b35]">{totalReg} hrs</strong></div>
            <div className="flex justify-between mb-1"><span>Leave hours</span><strong className="text-[#0b2b35]">{totalLeave} hrs</strong></div>
            <div className={`flex justify-between ${periodGross !== null ? 'mb-1' : ''} border-t border-[#e8f4f7] pt-1 mt-1`}><span>Total logged</span><strong className="text-[#0b2b35]">{total} / {TARGET_HOURS} hrs</strong></div>
            {periodGross !== null && (
              <div className="flex justify-between"><span>Pay period gross wages</span><strong className="text-[#0b2b35]">{currency(periodGross)}</strong></div>
            )}
          </div>
          <Link href="/dashboard" className="text-[#02ACC0] text-[13px] font-semibold hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  const week1 = rows.slice(0, 5)
  const week2 = rows.slice(5, 10)
  const week1Total = week1.reduce((s, r) => s + Number(r.regular_hours) + Number(r.leave_hours), 0)
  const week2Total = week2.reduce((s, r) => s + Number(r.regular_hours) + Number(r.leave_hours), 0)
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-show { display: block !important; }
          body { background: white !important; }
          input { border: none !important; background: transparent !important; padding: 2px 0 !important; }
        }
        @media screen { .print-show { display: none !important; } }
      `}</style>

      <div className="print-show mb-6 pb-4 border-b border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cha-logo.png" alt="CHA" style={{ height: 28, marginBottom: 8 }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0b2b35', margin: 0 }}>Timesheet — {formatPeriodLabel(period)}</h1>
        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          {employeeName} · Employee ID {employeeIdLabel} · Community Housing Associates · Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Timesheet</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">{employeeName} · Employee ID {employeeIdLabel}</p>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => switchPeriod(periodIdx + 1)} disabled={periodIdx >= periods.length - 1 || loading}
              className="text-gray-400 hover:text-[#0b2b35] disabled:opacity-30 text-[14px] transition-colors">‹</button>
            <span className="text-[13px] text-gray-500 font-medium">{formatPeriodLabel(period)}</span>
            <button onClick={() => switchPeriod(periodIdx - 1)} disabled={periodIdx === 0 || loading}
              className="text-gray-400 hover:text-[#0b2b35] disabled:opacity-30 text-[14px] transition-colors">›</button>
            <span className="text-[11px] text-amber-600 bg-amber-50 font-semibold px-2 py-0.5 rounded-full ml-1">
              Due {formatShort(dueDate)}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCsv}
            className="border border-[#d4eef2] text-[#0b2b35] text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors">
            ⬇ Export CSV
          </button>
          <button onClick={() => window.print()}
            className="border border-[#d4eef2] text-[#0b2b35] text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors">
            ⬇ Export PDF
          </button>
          <button onClick={saveDraft}
            className="border border-[#d4eef2] text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors">
            {savedDraft ? '✓ Saved' : 'Save Draft'}
          </button>
          <button
            disabled={!signed || submitting}
            onClick={handleSubmit}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? 'Submitting…' : 'Submit & Sign'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      {salary !== null && (
        <div className="bg-[#f8fcfd] border border-[#d4eef2] text-[#0b2b35] text-[12px] rounded-lg px-4 py-2.5 mb-4 no-print">
          Regular hours default to 8/day so this timesheet totals {TARGET_HOURS} hrs. If you took sick, PTO, or other time off, lower <strong>Regular</strong> and log the hours under <strong>Leave</strong> for that day so your balances stay accurate.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Regular', value: `${totalReg} hrs`, color: 'text-[#0b2b35]' },
          { label: 'Leave', value: `${totalLeave} hrs`, color: 'text-violet-600' },
          { label: 'Total', value: `${total} / ${TARGET_HOURS}`, color: over ? 'text-red-500' : 'text-[#0b2b35]' },
          { label: 'Remaining', value: over ? 'Over by ' + (total - TARGET_HOURS) + ' hrs' : `${remaining} hrs`, color: over ? 'text-red-500' : remaining === 0 ? 'text-emerald-600' : 'text-amber-600' },
          ...(weeklyGross !== null ? [{ label: 'Weekly Gross Wages', value: currency(weeklyGross), color: 'text-[#0b2b35]' }] : []),
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-[22px] font-black leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4 mb-6 flex items-center gap-4 no-print">
        <div className="flex-1 h-2.5 bg-[#f0f7f8] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : pct === 100 ? 'bg-emerald-500' : 'bg-[#02ACC0]'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[13px] font-bold flex-shrink-0 ${over ? 'text-red-500' : pct === 100 ? 'text-emerald-600' : 'text-[#0b2b35]'}`}>
          {pct}% complete
        </span>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <div className="min-w-[620px]">
        <div className="grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-2.5 bg-[#f9fefe] border-b border-[#d4eef2]">
          {['Date', 'Description / Project', 'Regular', 'Leave', 'Total'].map((h, i) => (
            <span key={h} className={`text-[10px] uppercase tracking-widest text-gray-400 font-semibold ${i >= 2 ? 'text-center' : ''}`}>{h}</span>
          ))}
        </div>

        <div className="px-5 py-2 bg-[#fafefe] border-b border-[#e8f4f7]">
          <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week 1</span>
        </div>
        {week1.map(row => <TimesheetRowView key={row.id} row={row} onUpdate={updateRow} />)}
        <div className="grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-2 bg-[#f9fefe] border-b-2 border-[#d4eef2] text-[12px]">
          <span className="text-gray-400 col-span-4 text-right font-semibold">
            Week 1 subtotal{weeklyGross !== null && <span className="text-gray-400 font-normal"> · {currency(weeklyGross)} gross</span>}
          </span>
          <span className="text-center font-bold text-[#0b2b35]">{week1Total} hrs</span>
        </div>

        <div className="px-5 py-2 bg-[#fafefe] border-b border-[#e8f4f7]">
          <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week 2</span>
        </div>
        {week2.map(row => <TimesheetRowView key={row.id} row={row} onUpdate={updateRow} />)}
        <div className="grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-2 bg-[#f9fefe] border-t border-[#d4eef2] text-[12px]">
          <span className="text-gray-400 col-span-4 text-right font-semibold">
            Week 2 subtotal{weeklyGross !== null && <span className="text-gray-400 font-normal"> · {currency(weeklyGross)} gross</span>}
          </span>
          <span className="text-center font-bold text-[#0b2b35]">{week2Total} hrs</span>
        </div>

        <div className="grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-3.5 bg-[#f0f7f8] border-t-2 border-[#d4eef2] text-[13px]">
          <span className="font-bold text-[#0b2b35]">Totals</span>
          <span />
          <span className="text-center font-bold text-[#0b2b35]">{totalReg}</span>
          <span className="text-center font-bold text-violet-600">{totalLeave}</span>
          <span className="text-center font-bold text-[#0b2b35]">{total} / {TARGET_HOURS}</span>
        </div>
        </div>
        </div>
      </div>

      {/* Expenses this period */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-5 mb-6 no-print flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[13px] font-bold text-[#0b2b35]">Expenses this period</p>
          <p className="text-[12px] text-gray-400">{expenses.length} submitted · ${expenseTotal.toFixed(2)} total</p>
        </div>
        <Link href="/expenses" className="text-[#02ACC0] text-[13px] font-semibold hover:underline">+ Add Expense</Link>
      </div>

      <div className="bg-white border border-[#d4eef2] rounded-xl p-4 sm:p-6 max-w-2xl">
        <p className="text-[14px] font-bold text-[#0b2b35] mb-0.5">Employee Certification &amp; Signature</p>
        <p className="text-[12px] text-gray-400 mb-5">
          By signing, I certify that the hours above are accurate and complete. This timesheet will be sent for approval.
        </p>

        <div
          onClick={() => setSigned(true)}
          className={`rounded-xl border-2 border-dashed px-6 py-4 cursor-pointer transition-colors text-center mb-4 ${
            signed ? 'border-emerald-400 bg-emerald-50' : 'border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f8fcfd]'
          }`}>
          {signed ? (
            <div>
              <p className="font-[cursive] text-[22px] text-[#0b2b35] mb-1">{employeeName}</p>
              <p className="text-[11px] text-gray-400">{employeeName} · Employee ID {employeeIdLabel} · Signed {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          ) : (
            <p className="text-gray-300 text-[13px]">Click here to sign</p>
          )}
        </div>

        {signed && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <span>✓</span>
            <span>Signature applied — click <strong>Submit &amp; Sign</strong> above to send for approval.</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TimesheetRowView({ row, onUpdate }: { row: EditableRow; onUpdate: (id: string, patch: Partial<EditableRow>) => void }) {
  const isLeave = Number(row.leave_hours) > 0
  const rowTotal = Number(row.regular_hours) + Number(row.leave_hours)
  const isEmpty = rowTotal === 0
  const d = new Date(`${row.work_date}T00:00:00`)
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
  const dayShort = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className={`grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-2.5 border-b border-[#f0f7f8] items-center text-[13px] transition-colors ${
      isLeave ? 'bg-violet-50/40' : isEmpty ? 'bg-amber-50/30' : ''
    }`}>
      <div>
        <p className="font-semibold text-[#0b2b35] text-[12px]">{dayName}</p>
        <p className="text-[10px] text-gray-400">{dayShort}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={row.description || ''}
          onChange={e => onUpdate(row.id, { description: e.target.value })}
          placeholder="Add description…"
          className="flex-1 px-2 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white"
        />
        {isLeave && <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Leave</span>}
        {isEmpty && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Incomplete</span>}
      </div>
      <HoursInput value={Number(row.regular_hours)} onChange={v => onUpdate(row.id, { regular_hours: v })} />
      <HoursInput value={Number(row.leave_hours)} onChange={v => onUpdate(row.id, { leave_hours: v })} />
      <div className={`text-center font-bold ${rowTotal === 8 ? 'text-emerald-600' : rowTotal === 0 ? 'text-gray-300' : 'text-amber-600'}`}>
        {rowTotal > 0 ? rowTotal : '—'}
      </div>
    </div>
  )
}

function HoursInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number" min={0} max={24} step={0.5}
      value={value || ''}
      placeholder="0"
      onChange={e => onChange(Math.max(0, Math.min(24, Number(e.target.value))))}
      className="w-full text-center px-2 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white"
    />
  )
}
