'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getOrCreateTimesheet, saveTimesheetDraft, submitTimesheet, requestTimesheetCorrection } from '@/app/actions/timesheets'
import { getExpensesForPeriod } from '@/app/actions/expenses'
import { formatEmployeeId } from '@/lib/constants/employee-id'
import { fmtDate, fmtDateShort, fmtDateRange } from '@/lib/format-date'
import { holidayOn } from '@/lib/holidays'
import RowTags from '@/components/RowTags'
import TagsCell from '@/components/TagsCell'
import { tagRows, timesheetTags, type RowTag } from '@/lib/timesheet-tags'
import type { Timesheet, TimesheetRow as TimesheetRowType, Expense, TimesheetTag } from '@/types'
import { getTimesheetDueDate, periodLockReason, closedRangeOverlapping, type ClosedRange, type PayPeriod } from '@/lib/pay-periods'

const TARGET_HOURS = 80
const AUTOSAVE_DELAY_MS = 1500

type EditableRow = TimesheetRowType & { dirty?: boolean }
type Salary = { annual_salary: number; effective_date: string; note: string | null } | null

const currency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function addDays(d: string, days: number): string {
  const date = new Date(`${d}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatShort(d: string): string {
  return fmtDateShort(d)
}

function formatPeriodLabel(p: PayPeriod): string {
  return fmtDateRange(p.start, p.end)
}

const SALARIED_DAILY_HOURS = 8

/**
 * For salaried employees, Regular is a derived field, not an independent
 * input: Leave (0.5-hr increments, capped at 8) always deducts from a fixed
 * 8-hr day so Regular + Leave === 8 by construction. Normalizes rows on
 * load too, so any pre-existing row saved before this rule (e.g.
 * regular=8/leave=2) self-corrects the next time it's opened.
 */
function normalizeRows(rows: TimesheetRowType[], salaried: boolean): EditableRow[] {
  if (!salaried) return rows
  return rows.map(r => {
    const holiday = Math.max(0, Math.min(SALARIED_DAILY_HOURS, Number(r.holiday_hours ?? 0)))
    const leave = Math.max(0, Math.min(SALARIED_DAILY_HOURS - holiday, Number(r.leave_hours)))
    return { ...r, holiday_hours: holiday, leave_hours: leave, regular_hours: SALARIED_DAILY_HOURS - leave - holiday }
  })
}

export default function TimesheetClient({
  employeeName,
  employeeNumber,
  employeeType,
  periods,
  initialTimesheet,
  initialRows,
  initialExpenses,
  salary,
  closedRanges,
  customTags,
}: {
  employeeName: string
  employeeNumber: number
  employeeType: string
  periods: PayPeriod[]
  initialTimesheet: Timesheet
  initialRows: TimesheetRowType[]
  initialExpenses: Expense[]
  salary: Salary
  closedRanges: ClosedRange[]
  customTags: TimesheetTag[]
}) {
  const isSalaried = salary !== null

  const [periodIdx, setPeriodIdx] = useState(0)
  const [timesheet, setTimesheet] = useState<Timesheet>(initialTimesheet)
  const [rows, setRows] = useState<EditableRow[]>(() => normalizeRows(initialRows, isSalaried))
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [loading, setLoading] = useState(false)
  const [signed, setSigned] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctionNote, setCorrectionNote] = useState('')
  const [correctionBusy, setCorrectionBusy] = useState(false)
  const [correctionError, setCorrectionError] = useState('')
  const [error, setError] = useState('')
  const savingRef = useRef(false)

  const period = periods[periodIdx]
  const dueDate = getTimesheetDueDate(period)
  const submitted = timesheet.status === 'submitted' || timesheet.status === 'approved'
  // Accounting closed dates in this period: a never-submitted draft can't be edited or submitted (a deliberately reopened one can — that's the CEO override).
  const closedHit = closedRangeOverlapping(period.start, period.end, closedRanges)
  const closedForEdit = !!closedHit && timesheet.status === 'draft' && !timesheet.return_reason

  const totalReg = rows.reduce((s, r) => s + Number(r.regular_hours), 0)
  const totalLeave = rows.reduce((s, r) => s + Number(r.leave_hours), 0)
  const totalHoliday = rows.reduce((s, r) => s + Number(r.holiday_hours ?? 0), 0)
  const total = totalReg + totalLeave + totalHoliday
  const pct = Math.min(Math.round((total / TARGET_HOURS) * 100), 100)
  const remaining = Math.max(TARGET_HOURS - total, 0)
  const over = total > TARGET_HOURS

  const employeeIdLabel = formatEmployeeId(employeeNumber)
  const weeklyGross = salary ? Number(salary.annual_salary) / 52 : null
  const periodGross = weeklyGross !== null ? weeklyGross * 2 : null
  const hasUnsaved = rows.some(r => r.dirty)

  /** Shared by the debounced autosave, the manual "Save" button, and pre-submit/pre-switch flushes, so every save path leaves rows/status consistent. */
  async function persist(rowsSnapshot: EditableRow[]) {
    if (savingRef.current) return
    savingRef.current = true
    setSaveStatus('saving')
    try {
      await saveTimesheetDraft(timesheet.id, rowsSnapshot.map(r => ({
        id: r.id,
        description: r.description,
        regular_hours: Number(r.regular_hours),
        leave_hours: Number(r.leave_hours),
        tag_ids: r.tag_ids ?? [],
      })))
      setRows(rs => rs.map(r => ({ ...r, dirty: false })))
      setSaveStatus('idle')
    } catch (e: unknown) {
      setSaveStatus('error')
      setError(e instanceof Error ? e.message : 'Failed to save changes')
      throw e
    } finally {
      savingRef.current = false
    }
  }

  // Autosave: debounce edits, then persist. Effect re-runs (and its cleanup
  // clears the pending timer) on every keystroke, so only a pause in typing
  // actually triggers a save.
  useEffect(() => {
    if (!rows.some(r => r.dirty)) return
    const t = setTimeout(() => { void persist(rows) }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  // Backstop for the brief window before autosave fires (or if it fails):
  // warn on tab close/refresh so edits are never silently lost.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (rows.some(r => r.dirty)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [rows])

  async function switchPeriod(newIdx: number) {
    if (newIdx < 0 || newIdx >= periods.length || newIdx === periodIdx) return
    setLoading(true)
    setError('')
    setSigned(false)
    try {
      // Flush pending edits before navigating away — otherwise an in-flight
      // debounce for the old period would fire after `rows` has already
      // been replaced with the new period's data.
      if (rows.some(r => r.dirty)) await persist(rows)

      const p = periods[newIdx]
      const [{ timesheet: ts, rows: r }, exp] = await Promise.all([
        getOrCreateTimesheet(p.start, p.end),
        getExpensesForPeriod(timesheet.employee_id, p.start, p.end).catch(() => []),
      ])
      setPeriodIdx(newIdx)
      setTimesheet(ts)
      setRows(normalizeRows(r, isSalaried))
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
      await persist(rows)
    } catch {
      // error already surfaced by persist()
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      await persist(rows)
      await submitTimesheet(timesheet.id)
      setTimesheet(t => ({ ...t, status: 'submitted', return_reason: null }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit timesheet')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCorrectionRequest() {
    setCorrectionBusy(true)
    setCorrectionError('')
    try {
      await requestTimesheetCorrection(timesheet.id, correctionNote)
      setTimesheet(t => ({ ...t, correction_requested_at: new Date().toISOString(), correction_note: correctionNote.trim() }))
      setShowCorrection(false)
      setCorrectionNote('')
    } catch (e: unknown) {
      setCorrectionError(e instanceof Error ? e.message : 'Failed to send request')
    } finally {
      setCorrectionBusy(false)
    }
  }

  function exportCsv() {
    const headers = ['Employee', 'Employee ID', 'Date', 'Description', 'Tags', 'Regular Hours', 'Leave Hours', 'Holiday Hours', 'Total Hours']
    const csvRows = rows.map(r => [employeeName, employeeIdLabel, r.work_date, r.description || '', (tagsById.get(r.id) ?? []).map(t => t.label).join('; '), r.regular_hours, r.leave_hours, r.holiday_hours ?? 0, Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0)])
    csvRows.push([employeeName, employeeIdLabel, '', 'Totals', '', totalReg, totalLeave, totalHoliday, total])
    if (weeklyGross !== null && periodGross !== null) {
      csvRows.push([employeeName, employeeIdLabel, '', 'Weekly Gross Wages', '', '', '', '', weeklyGross.toFixed(2)])
      csvRows.push([employeeName, employeeIdLabel, '', 'Pay Period Gross Wages', '', '', '', '', periodGross.toFixed(2)])
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
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-2">{timesheet.status === 'approved' ? 'Timesheet Approved' : 'Timesheet Submitted'}</h2>
          <p className="text-[13px] text-gray-500 mb-1">{formatPeriodLabel(period)}</p>
          <p className="text-[13px] text-gray-500 mb-5">
            {timesheet.status === 'approved'
              ? 'Your approver has reviewed and approved this timesheet.'
              : 'Sent for approval. You\u2019ll get an email and a portal notification when it\u2019s reviewed.'}
          </p>
          <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-xl p-4 text-left text-[12px] text-gray-500 mb-5">
            <div className="flex justify-between mb-1"><span>Regular hours</span><strong className="text-[#0b2b35]">{totalReg} hrs</strong></div>
            <div className="flex justify-between mb-1"><span>Leave hours</span><strong className="text-[#0b2b35]">{totalLeave} hrs</strong></div>
            <div className="flex justify-between mb-1"><span>Holiday hours</span><strong className="text-[#0b2b35]">{totalHoliday} hrs</strong></div>
            <div className={`flex justify-between ${periodGross !== null ? 'mb-1' : ''} border-t border-[#e8f4f7] pt-1 mt-1`}><span>Total logged</span><strong className="text-[#0b2b35]">{total} / {TARGET_HOURS} hrs</strong></div>
            {periodGross !== null && (
              <div className="flex justify-between"><span>Pay period gross wages</span><strong className="text-[#0b2b35]">{currency(periodGross)}</strong></div>
            )}
          </div>
          {timesheet.correction_requested_at ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-[12px] text-amber-800 mb-5">
              <p className="font-semibold">Correction requested {fmtDate(timesheet.correction_requested_at)}</p>
              <p className="mt-1 whitespace-pre-line">{timesheet.correction_note}</p>
              <p className="mt-2 text-amber-700">An approver will reopen your timesheet, or reply if they have questions.</p>
            </div>
          ) : showCorrection ? (
            <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-xl p-4 text-left mb-5">
              <p className="text-[12px] font-semibold text-[#0b2b35] mb-1">What needs to be corrected?</p>
              {periodLockReason(period, closedRanges) && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                  Accounting has closed this pay period. A correction now needs a CEO override, so your request goes to the CEO.
                </p>
              )}
              <textarea value={correctionNote} onChange={e => setCorrectionNote(e.target.value)} rows={3} placeholder="e.g. I worked 6 hours on Thursday, not 8"
                className="w-full text-[12px] border border-[#d4eef2] rounded-lg px-3 py-2 mb-2 focus:outline-none focus:border-[#02ACC0] bg-white resize-none" />
              {correctionError && <p className="text-[12px] text-red-600 mb-2">{correctionError}</p>}
              <div className="flex gap-2">
                <button onClick={handleCorrectionRequest} disabled={correctionBusy || !correctionNote.trim()}
                  className="bg-[#02ACC0] text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">{correctionBusy ? 'Sending…' : 'Send request'}</button>
                <button onClick={() => { setShowCorrection(false); setCorrectionNote('') }} className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-[#d4eef2] text-gray-600 hover:bg-white">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCorrection(true)} className="text-[13px] font-semibold text-[#02ACC0] hover:underline mb-4 block mx-auto">Request a correction</button>
          )}
          <Link href="/dashboard" className="text-[#02ACC0] text-[13px] font-semibold hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  const dayTags = tagRows(rows, { fullTime: employeeType === 'full-time', customTags })
  const tagsById = new Map(rows.map((r, i) => [r.id, dayTags[i]]))
  const sheetTags = timesheetTags({ status: timesheet.status, return_reason: timesheet.return_reason, correction_requested_at: timesheet.correction_requested_at, lock_reason: periodLockReason(period, closedRanges) })
  const week1 = rows.slice(0, 5)
  const week2 = rows.slice(5, 10)
  const week1Total = week1.reduce((s, r) => s + Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0), 0)
  const week2Total = week2.reduce((s, r) => s + Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0), 0)
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
          {employeeName} · Employee ID {employeeIdLabel} · Community Housing Associates · Generated {fmtDate(new Date())}
        </p>
      </div>

      {closedForEdit && closedHit && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 no-print">
          <p className="text-[13px] font-semibold text-red-800">This pay period is closed</p>
          <p className="text-[13px] text-red-700 mt-1">
            Accounting closed {fmtDateRange(closedHit.start, closedHit.end)}, so this timesheet can no longer be edited or submitted. Contact your Accounting Manager if it needs to be reopened.
          </p>
        </div>
      )}

      {timesheet.return_reason && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 no-print">
          <p className="text-[13px] font-semibold text-amber-800">Returned for correction</p>
          <p className="text-[13px] text-amber-700 mt-1 whitespace-pre-line">{timesheet.return_reason}</p>
          <p className="text-[12px] text-amber-600 mt-2">Update your entries, then sign and submit again.</p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Timesheet</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">{employeeName} · Employee ID {employeeIdLabel}</p>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => switchPeriod(periodIdx + 1)} disabled={periodIdx >= periods.length - 1 || loading}
              className="text-gray-400 hover:text-[#0b2b35] disabled:opacity-30 text-[14px] transition-colors">‹</button>
            <select
              value={periodIdx}
              onChange={e => switchPeriod(Number(e.target.value))}
              disabled={loading}
              className="text-[13px] text-gray-600 font-medium bg-transparent border border-[#d4eef2] rounded-lg px-2 py-1 focus:outline-none focus:border-[#02ACC0] disabled:opacity-50">
              {periods.map((p, i) => (
                <option key={p.start} value={i}>{formatPeriodLabel(p)}{i === 0 ? ' (current)' : ''}</option>
              ))}
            </select>
            <button onClick={() => switchPeriod(periodIdx - 1)} disabled={periodIdx === 0 || loading}
              className="text-gray-400 hover:text-[#0b2b35] disabled:opacity-30 text-[14px] transition-colors">›</button>
            <span className="text-[11px] text-amber-600 bg-amber-50 font-semibold px-2 py-0.5 rounded-full ml-1">
              Due {formatShort(dueDate)}
            </span>
            <RowTags tags={sheetTags} dashWhenEmpty={false} />
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
          <button
            onClick={saveDraft}
            disabled={saveStatus === 'saving'}
            className={`text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors border disabled:opacity-60 disabled:cursor-not-allowed ${
              saveStatus === 'error' ? 'border-red-200 text-red-500 hover:bg-red-50'
              : hasUnsaved ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
              : 'border-[#d4eef2] text-[#0b2b35] hover:bg-[#f0f7f8]'
            }`}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Retry Save' : hasUnsaved ? 'Save Now' : '✓ All changes saved'}
          </button>
          <button
            disabled={!signed || submitting || closedForEdit}
            onClick={handleSubmit}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? 'Submitting…' : 'Submit & Sign'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      {isSalaried && (
        <div className="bg-[#f8fcfd] border border-[#d4eef2] text-[#0b2b35] text-[12px] rounded-lg px-4 py-2.5 mb-4 no-print">
          Regular hours default to 8 on every workday; scheduled holidays are filled in automatically as <strong>Holiday</strong> hours instead, so this timesheet totals {TARGET_HOURS} hrs. The <strong>Leave</strong> column fills in automatically from your leave requests — <Link href="/request" className="text-[#028a9e] font-semibold hover:underline">request leave</Link> to take time off (sick leave is approved instantly when your balance covers it), and <strong>Regular</strong> adjusts so each day still totals 8.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Regular', value: `${totalReg} hrs`, color: 'text-[#0b2b35]' },
          { label: 'Leave', value: `${totalLeave} hrs`, color: 'text-violet-600' },
          { label: 'Holiday', value: `${totalHoliday} hrs`, color: 'text-rose-500' },
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

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6 max-w-[900px]">
        <div className="overflow-x-auto">
        <div className="min-w-[820px]">
        <div className="grid grid-cols-[90px_260px_180px_56px_56px_56px_60px] gap-2 px-5 py-2.5 bg-[#f9fefe] border-b border-[#d4eef2]">
          {['Date', 'Description / Project', 'Tags', 'Regular', 'Leave', 'Holiday', 'Total'].map((h, i) => (
            <span key={h} className={`uppercase text-gray-400 font-semibold ${i >= 3 ? 'text-center text-[9px] tracking-wider' : 'text-[10px] tracking-widest'}`}>{h}</span>
          ))}
        </div>

        <div className="px-5 py-2 bg-[#fafefe] border-b border-[#e8f4f7]">
          <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week 1</span>
        </div>
        {week1.map(row => <TimesheetRowView key={row.id} row={row} tags={tagsById.get(row.id) ?? []} allTags={customTags} onUpdate={updateRow} isSalaried={isSalaried} locked={closedForEdit} />)}
        <div className="grid grid-cols-[90px_260px_180px_56px_56px_56px_60px] gap-2 px-5 py-2 bg-[#f9fefe] border-b-2 border-[#d4eef2] text-[12px]">
          <span className="text-gray-400 col-span-6 text-right font-semibold">
            Week 1 subtotal{weeklyGross !== null && <span className="text-gray-400 font-normal"> · {currency(weeklyGross)} gross</span>}
          </span>
          <span className="text-center font-bold text-[#0b2b35]">{week1Total} hrs</span>
        </div>

        <div className="px-5 py-2 bg-[#fafefe] border-b border-[#e8f4f7]">
          <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week 2</span>
        </div>
        {week2.map(row => <TimesheetRowView key={row.id} row={row} tags={tagsById.get(row.id) ?? []} allTags={customTags} onUpdate={updateRow} isSalaried={isSalaried} locked={closedForEdit} />)}
        <div className="grid grid-cols-[90px_260px_180px_56px_56px_56px_60px] gap-2 px-5 py-2 bg-[#f9fefe] border-t border-[#d4eef2] text-[12px]">
          <span className="text-gray-400 col-span-6 text-right font-semibold">
            Week 2 subtotal{weeklyGross !== null && <span className="text-gray-400 font-normal"> · {currency(weeklyGross)} gross</span>}
          </span>
          <span className="text-center font-bold text-[#0b2b35]">{week2Total} hrs</span>
        </div>

        <div className="grid grid-cols-[90px_260px_180px_56px_56px_56px_60px] gap-2 px-5 py-3.5 bg-[#f0f7f8] border-t-2 border-[#d4eef2] text-[13px]">
          <span className="font-bold text-[#0b2b35]">Totals</span>
          <span />
          <span />
          <span className="text-center font-bold text-[#0b2b35]">{totalReg}</span>
          <span className="text-center font-bold text-violet-600">{totalLeave}</span>
          <span className="text-center font-bold text-rose-500">{totalHoliday}</span>
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
              <p className="text-[11px] text-gray-400">{employeeName} · Employee ID {employeeIdLabel} · Signed {fmtDate(new Date())}</p>
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

function TimesheetRowView({ row, tags, allTags, onUpdate, isSalaried, locked }: { row: EditableRow; tags: RowTag[]; allTags: TimesheetTag[]; onUpdate: (id: string, patch: Partial<EditableRow>) => void; isSalaried: boolean; locked: boolean }) {
  const isLeave = Number(row.leave_hours) > 0
  const isHoliday = !!holidayOn(row.work_date)
  const rowTotal = Number(row.regular_hours) + Number(row.leave_hours) + Number(row.holiday_hours ?? 0)
  const isEmpty = rowTotal === 0 && !isHoliday
  const d = new Date(`${row.work_date}T00:00:00`)
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
  const dayShort = fmtDateShort(d)

  return (
    <div className={`grid grid-cols-[90px_260px_180px_56px_56px_56px_60px] gap-2 px-5 py-2.5 border-b border-[#f0f7f8] items-center text-[13px] transition-colors ${
      isHoliday ? 'bg-rose-50/40' : isLeave ? 'bg-violet-50/40' : isEmpty ? 'bg-amber-50/30' : ''
    }`}>
      <div>
        <p className="font-semibold text-[#0b2b35] text-[12px]">{dayName}</p>
        <p className="text-[10px] text-gray-400">{dayShort}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={row.description || ''}
          onChange={e => onUpdate(row.id, { description: e.target.value })}
          disabled={locked}
          placeholder="Add description…"
          className="flex-1 px-2 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white"
        />
      </div>
      <div className="flex items-center"><TagsCell tags={tags} allTags={allTags} selectedIds={row.tag_ids ?? []} editable={!locked} onChange={ids => onUpdate(row.id, { tag_ids: ids })} /></div>
      {isSalaried ? (
        <div
          title="Calculated automatically as 8 minus Leave hours"
          className="w-full text-center px-1 py-1.5 border border-[#e8f4f7] rounded-lg text-[13px] bg-[#f9fefe] text-gray-500 cursor-default">
          {Number(row.regular_hours)}
        </div>
      ) : (
        <HoursInput value={Number(row.regular_hours)} onChange={v => onUpdate(row.id, { regular_hours: v })} disabled={locked} />
      )}
      <div
        title="Added automatically from approved leave requests — use Request/Use Leave to take time off"
        className="w-full text-center px-1 py-1.5 border border-[#e8f4f7] rounded-lg text-[13px] bg-[#f9fefe] text-gray-500 cursor-default">
        {Number(row.leave_hours)}
      </div>
      <div
        title="Filled automatically on scheduled holidays"
        className="w-full text-center px-1 py-1.5 border border-[#e8f4f7] rounded-lg text-[13px] bg-[#f9fefe] text-gray-500 cursor-default">
        {Number(row.holiday_hours ?? 0)}
      </div>
      <div className={`text-center font-bold ${rowTotal === 8 ? 'text-emerald-600' : rowTotal === 0 ? 'text-gray-300' : 'text-amber-600'}`}>
        {rowTotal > 0 ? rowTotal : '—'}
      </div>
    </div>
  )
}

function HoursInput({ value, onChange, max = 24, disabled = false }: { value: number; onChange: (v: number) => void; max?: number; disabled?: boolean }) {
  return (
    <input
      type="number" min={0} max={max} step={0.5}
      value={value || ''}
      placeholder="0"
      disabled={disabled}
      onChange={e => onChange(Math.max(0, Math.min(max, Number(e.target.value))))}
      className="w-full text-center px-1 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white disabled:bg-[#f9fefe] disabled:text-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  )
}
