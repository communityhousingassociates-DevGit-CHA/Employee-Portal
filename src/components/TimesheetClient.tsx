'use client'

import { errMsg } from '@/lib/user-error'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getOrCreateTimesheet, saveTimesheetDraft, manualEditTimesheet, viewTimesheet, submitTimesheet, requestTimesheetCorrection, getPeriodSummaries, addWeekendRows, type PeriodSummary } from '@/app/actions/timesheets'
import OnBehalfPanel from '@/components/OnBehalfPanel'
import { onBehalfProblem } from '@/lib/constants/on-behalf'
import { TIMESHEET_ATTESTATION, timesheetOnBehalfAttestation } from '@/lib/constants/timesheet-signature'
import { getExpensesForPeriod } from '@/app/actions/expenses'
import { formatEmployeeId } from '@/lib/constants/employee-id'
import { fmtDate, fmtDateShort, fmtDateRange } from '@/lib/format-date'
import { holidayOn, type YearEndChoice } from '@/lib/holidays'
import RowTags from '@/components/RowTags'
import TagsCell from '@/components/TagsCell'
import { tagRows, timesheetTags, type RowTag } from '@/lib/timesheet-tags'
import type { Timesheet, TimesheetAudit, TimesheetRow as TimesheetRowType, Expense, TimesheetTag } from '@/types'
import TimesheetSignatures, { TimesheetHistory } from '@/components/TimesheetSignatures'
import { getTimesheetDueDate, getPayDate, periodLockReason, closedRangeOverlapping, type ClosedRange, type PayPeriod, todayET } from '@/lib/pay-periods'

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

function formatPeriodLabel(p: PayPeriod): string {
  return fmtDateRange(p.start, p.end)
}

const DOW_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 25 – Nov 7, 2026" — the year is shown once, on the end date. */
function fmtPeriodTitle(p: PayPeriod): string {
  const [, sm, sd] = p.start.split('-').map(Number)
  const [ey, em, ed] = p.end.split('-').map(Number)
  return `${MONTHS[sm - 1]} ${sd} – ${MONTHS[em - 1]} ${ed}, ${ey}`
}

/** "Mon, Nov 9" */
function fmtDayLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

const isWeekendDate = (iso: string) => { const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); return dow === 0 || dow === 6 }

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
  // Regular hours are only populated up to today (Eastern Time); holidays and approved leave show on their day even in the future.
  const today = todayET()
  return rows.map(r => {
    if (isWeekendDate(r.work_date)) return r // weekend hours are entered by hand, never calculated
    const future = r.work_date > today
    const holiday = Math.max(0, Math.min(SALARIED_DAILY_HOURS, Number(r.holiday_hours ?? 0)))
    const leave = Math.max(0, Math.min(SALARIED_DAILY_HOURS - holiday, Number(r.leave_hours)))
    return { ...r, holiday_hours: holiday, leave_hours: leave, regular_hours: future ? 0 : SALARIED_DAILY_HOURS - leave - holiday }
  })
}

const EMPTY_AUDIT: TimesheetAudit = { submitted_by_name: null, submitted_by_role: null, approver_name: null, approver_role: null, events: [] }

/** Stand-in shown while a period has no timesheet yet (nothing exists in the database until someone presses Create). */
function placeholderSheet(employeeId: string, p: PayPeriod): Timesheet {
  return { id: '', employee_id: employeeId, period_start: p.start, period_end: p.end, status: 'draft', employee_signed_at: null, approver_id: null, approved_at: null, return_reason: null, correction_requested_at: null, correction_note: null, created_at: '' }
}

export default function TimesheetClient({
  selfId,
  people,
  canEditClosed,
  initialPeriodIdx,
  employeeId,
  employeeName,
  employeeNumber,
  employeeType,
  yearEnd,
  periods,
  initialTimesheet,
  initialRows,
  initialAudit,
  initialExpenses,
  salary,
  salaried,
  onBehalf,
  closedRanges,
  customTags,
}: {
  /** The signed-in employee, and (for Nico, Carrileen and the super admin only) everyone they may open from the picker. */
  selfId: string
  people: { id: string; name: string; employee_number: number }[]
  /** May override a pay period accounting has closed (the CEO / super admin). */
  canEditClosed: boolean
  initialPeriodIdx: number
  /** Whose timesheet this is. */
  employeeId: string
  employeeName: string
  employeeNumber: number
  employeeType: string
  yearEnd?: YearEndChoice | null
  periods: PayPeriod[]
  /** Null when viewing someone else's timesheet for a period in which none exists yet. */
  initialTimesheet: Timesheet | null
  initialRows: TimesheetRowType[]
  initialAudit: TimesheetAudit | null
  initialExpenses: Expense[]
  salary: Salary
  /** Whether this employee is salaried (hours auto-fill to 8/day). Separate from `salary` so an admin acting for them never receives the amount. */
  salaried: boolean
  /** Set when an admin is completing this for another employee (an exception — see OnBehalfPanel). */
  onBehalf?: { employeeId: string; actorName: string }
  closedRanges: ClosedRange[]
  customTags: TimesheetTag[]
}) {
  const isSalaried = salaried

  const router = useRouter()
  // Another employee's sheet shows the values actually stored (never recomputed), so a manual override is what you see after a reload.
  const normalizeFor = (r: TimesheetRowType[]) => normalizeRows(r, isSalaried && !onBehalf)
  const [periodIdx, setPeriodIdx] = useState(initialPeriodIdx)
  const [timesheet, setTimesheet] = useState<Timesheet>(() => initialTimesheet ?? placeholderSheet(employeeId, periods[initialPeriodIdx]))
  const [audit, setAudit] = useState<TimesheetAudit>(initialAudit ?? EMPTY_AUDIT)
  const [missing, setMissing] = useState(!initialTimesheet)
  // Someone else's timesheet is READ-ONLY until Override / Edit is pressed; every save is then logged to the audit trail.
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<EditableRow[]>(() => normalizeRows(initialRows, isSalaried && !onBehalf))
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [loading, setLoading] = useState(false)
  const [signed, setSigned] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [summaries, setSummaries] = useState<PeriodSummary[] | null>(null)
  // Weekend days only show when someone toggles them on (or already has hours logged on one).
  const [weekendsOn, setWeekendsOn] = useState(() => initialRows.some(r => isWeekendDate(r.work_date) && Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0) > 0))
  const [weekendBusy, setWeekendBusy] = useState(false)
  const [stuck, setStuck] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  // Status + hours for every period, refreshed each time the picker opens.
  useEffect(() => {
    if (!pickerOpen) return
    let cancelled = false
    getPeriodSummaries(periods.map(p => p.start), onBehalf?.employeeId)
      .then(r => { if (!cancelled) setSummaries(r) })
      .catch(() => { if (!cancelled) setSummaries(null) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen])
  // Close the period picker on outside click / Escape.
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (e: MouseEvent) => { if (!pickerRef.current?.contains(e.target as Node) && !headerRef.current?.querySelector('[aria-haspopup]')?.contains(e.target as Node)) setPickerOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [pickerOpen])
  // Show the compact bar once the period header has scrolled out of view.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctionNote, setCorrectionNote] = useState('')
  const [correctionBusy, setCorrectionBusy] = useState(false)
  const [correctionError, setCorrectionError] = useState('')
  const [error, setError] = useState('')
  const savingRef = useRef(false)
  const [behalf, setBehalf] = useState({ reasonCode: '', note: '' })
  // On behalf of an employee the sheet stays read-only until a reason code and notes are given (the server re-checks).
  const behalfIssue = onBehalf && editing ? onBehalfProblem(behalf) : null

  const period = periods[periodIdx]
  const dueDate = getTimesheetDueDate(period)
  const submitted = timesheet.status === 'submitted' || timesheet.status === 'approved'
  // Accounting closed dates in this period: a never-submitted draft can't be edited or submitted (a deliberately reopened one can — that's the CEO override).
  const closedHit = closedRangeOverlapping(period.start, period.end, closedRanges)
  const closedForEdit = !!closedHit && timesheet.status === 'draft' && !timesheet.return_reason
  // An override of a closed period is the CEO's (or super admin's) alone — the server enforces it too.
  const closedBlocksOverride = !!onBehalf && !!closedHit && !timesheet.return_reason && !canEditClosed
  /** Whether the grid is locked: someone else's sheet until Override / Edit is on (and a reason is given); your own once submitted or closed. */
  const readOnly = onBehalf ? !editing || !!behalfIssue || closedBlocksOverride : closedForEdit || submitted
  const canSubmitOnBehalf = !!onBehalf && editing && timesheet.status === 'draft' && !closedBlocksOverride

  const totalReg = rows.reduce((s, r) => s + Number(r.regular_hours), 0)
  const totalLeave = rows.reduce((s, r) => s + Number(r.leave_hours), 0)
  const totalHoliday = rows.reduce((s, r) => s + Number(r.holiday_hours ?? 0), 0)
  const total = totalReg + totalLeave + totalHoliday
  // The 80-hour target is for the regular Monday–Friday schedule; weekend hours are extra and tracked on their own.
  const weekendTotal = rows.filter(r => isWeekendDate(r.work_date)).reduce((s, r) => s + Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0), 0)
  const weekdayTotal = total - weekendTotal
  const pct = Math.min(Math.round((weekdayTotal / TARGET_HOURS) * 100), 100)
  const remaining = Math.max(TARGET_HOURS - weekdayTotal, 0)
  const over = weekdayTotal > TARGET_HOURS

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
      const payload = rowsSnapshot.map(r => ({
        id: r.id,
        description: r.description,
        regular_hours: Number(r.regular_hours),
        leave_hours: Number(r.leave_hours),
        holiday_worked_hours: Number(r.holiday_worked_hours ?? 0),
        tag_ids: r.tag_ids ?? [],
      }))
      if (onBehalf) {
        // A manual override: one explicit save = one audit event with the before/after of every field changed.
        await manualEditTimesheet(timesheet.id, payload, behalf)
        const fresh = await viewTimesheet(onBehalf.employeeId, period.start)
        if (fresh.audit) setAudit(fresh.audit)
      } else {
        await saveTimesheetDraft(timesheet.id, payload)
      }
      setRows(rs => rs.map(r => ({ ...r, dirty: false })))
      setSaveStatus('idle')
    } catch (e: unknown) {
      setSaveStatus('error')
      setError(errMsg(e, 'Failed to save changes'))
      throw e
    } finally {
      savingRef.current = false
    }
  }

  // Autosave: debounce edits, then persist. Effect re-runs (and its cleanup
  // clears the pending timer) on every keystroke, so only a pause in typing
  // actually triggers a save.
  useEffect(() => {
    if (onBehalf || !rows.some(r => r.dirty)) return
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
      if (rows.some(r => r.dirty)) {
        if (onBehalf) { setError('Save your changes (or exit edit mode) before switching pay periods.'); return }
        await persist(rows)
      }

      const p = periods[newIdx]
      const [view, exp] = await Promise.all([
        onBehalf ? viewTimesheet(onBehalf.employeeId, p.start) : getOrCreateTimesheet(p.start, p.end),
        getExpensesForPeriod(employeeId, p.start, p.end).catch(() => []),
      ])
      setPeriodIdx(newIdx)
      setEditing(false)
      setBehalf({ reasonCode: '', note: '' })
      setMissing(!view.timesheet)
      setTimesheet(view.timesheet ?? placeholderSheet(employeeId, p))
      setAudit(view.audit ?? EMPTY_AUDIT)
      setRows(normalizeFor(view.rows))
      setWeekendsOn(view.rows.some(r => isWeekendDate(r.work_date) && Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0) > 0))
      setExpenses(exp)
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to load period'))
    } finally {
      setLoading(false)
    }
  }

  /** Open another employee's timesheet (same pay period), or go back to your own. */
  function openPerson(id: string) {
    if (id === employeeId) return
    if (rows.some(r => r.dirty)) { setError('Save your changes (or exit edit mode) before switching employees.'); return }
    router.push(`/timesheet?${id === selfId ? '' : `for=${id}&`}period=${period.start}`)
  }

  /** Leave edit mode; unsaved edits are discarded by reloading what is stored. */
  async function exitEdit() {
    setError('')
    if (rows.some(r => r.dirty) && onBehalf) {
      setLoading(true)
      try {
        const v = await viewTimesheet(onBehalf.employeeId, period.start)
        if (v.timesheet) { setTimesheet(v.timesheet); setRows(normalizeFor(v.rows)); if (v.audit) setAudit(v.audit) }
      } catch (e: unknown) { setError(errMsg(e, 'Failed to reload')) } finally { setLoading(false) }
    }
    setEditing(false); setSigned(false); setBehalf({ reasonCode: '', note: '' })
  }

  /** The period has no timesheet yet: create the (draft) timesheet so it can be completed on the employee's behalf. */
  async function createSheet() {
    if (!onBehalf) return
    setLoading(true); setError('')
    try {
      const r = await getOrCreateTimesheet(period.start, period.end, onBehalf.employeeId)
      setTimesheet(r.timesheet); setAudit(r.audit); setRows(normalizeFor(r.rows)); setMissing(false)
    } catch (e: unknown) { setError(errMsg(e, 'Failed to create timesheet')) } finally { setLoading(false) }
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
      await submitTimesheet(timesheet.id, onBehalf ? behalf : undefined)
      // Reload what was just recorded (who signed, the exception reason, history) so the signatures show right away.
      const fresh = await getOrCreateTimesheet(period.start, period.end, onBehalf?.employeeId)
      setTimesheet(fresh.timesheet)
      setAudit(fresh.audit)
      setRows(normalizeFor(fresh.rows))
      setSigned(false)
      setEditing(false)
    } catch (e: unknown) {
      setError(errMsg(e, 'Failed to submit timesheet'))
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
      setCorrectionError(errMsg(e, 'Failed to send request'))
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

  // A submitted or approved timesheet stays fully visible (read-only) with its signatures at the bottom; this banner says where it stands.
  const submittedBanner = submitted && !loading ? (
    <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 no-print">
      <div className="flex items-start gap-3">
        <span className="text-[22px] leading-none">✅</span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-[#0b2b35]">{timesheet.status === 'approved' ? 'Timesheet approved' : 'Timesheet submitted'} — {formatPeriodLabel(period)}</h2>
          <p className="text-[13px] text-gray-600 mt-0.5">
            {onBehalf
              ? audit.submitted_by_name
                ? `Submitted on ${employeeName}\u2019s behalf by ${audit.submitted_by_name} (an exception \u2014 see the signatures below). ${timesheet.status === 'approved' ? 'It has been approved.' : 'It is waiting for the approver\u2019s review.'}`
                : `${employeeName} submitted this timesheet. ${timesheet.status === 'approved' ? 'It has been approved.' : 'It is waiting for the approver\u2019s review.'}`
              : audit.submitted_by_name
              ? `Submitted on your behalf by ${audit.submitted_by_name} (an exception — see the signatures below). ${timesheet.status === 'approved' ? 'Your approver has reviewed and approved it.' : 'It is waiting for your approver\u2019s review.'}`
              : timesheet.status === 'approved'
              ? 'Your approver has reviewed and approved this timesheet.'
              : 'Sent for approval. You\u2019ll get an email and a portal notification when it\u2019s reviewed.'}
          </p>
        </div>
      </div>
      <div className="mt-3 text-left">
          {onBehalf ? null : timesheet.correction_requested_at ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-[12px] text-amber-800 mb-3">
              <p className="font-semibold">Correction requested {fmtDate(timesheet.correction_requested_at)}</p>
              <p className="mt-1 whitespace-pre-line">{timesheet.correction_note}</p>
              <p className="mt-2 text-amber-700">An approver will reopen your timesheet, or reply if they have questions.</p>
            </div>
          ) : showCorrection ? (
            <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-xl p-4 text-left mb-3">
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
            <button onClick={() => setShowCorrection(true)} className="text-[13px] font-semibold text-[#02ACC0] hover:underline block">Request a correction</button>
          )}
      </div>
    </div>
  ) : null

  const dayTags = tagRows(rows, { fullTime: employeeType === 'full-time', customTags, yearEnd })
  const tagsById = new Map(rows.map((r, i) => [r.id, dayTags[i]]))
  const sheetTags = timesheetTags({ status: timesheet.status, return_reason: timesheet.return_reason, correction_requested_at: timesheet.correction_requested_at, lock_reason: periodLockReason(period, closedRanges) })
  // Weeks split by date (the period starts on a Sunday); weekend rows are listed only when switched on.
  const weekEnd1 = addDays(period.start, 6)
  const listed = rows.filter(r => weekendsOn || !isWeekendDate(r.work_date))
  const week1 = listed.filter(r => r.work_date <= weekEnd1)
  const week2 = listed.filter(r => r.work_date > weekEnd1)
  const week1Total = week1.reduce((s, r) => s + Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0), 0)
  const week2Total = week2.reduce((s, r) => s + Number(r.regular_hours) + Number(r.leave_hours) + Number(r.holiday_hours ?? 0), 0)
  const weekendRowsExist = rows.some(r => isWeekendDate(r.work_date))
  const canAddWeekend = !readOnly && timesheet.status === 'draft' && !missing
  async function toggleWeekends() {
    if (weekendsOn) { setWeekendsOn(false); return }
    setWeekendsOn(true)
    if (weekendRowsExist || !canAddWeekend) return
    setWeekendBusy(true); setError('')
    try {
      // Flush edits first so the refreshed rows can't overwrite what was just typed.
      if (rows.some(r => r.dirty) && !onBehalf) await persist(rows)
      const fresh = await addWeekendRows(timesheet.id, onBehalf ? behalf : undefined)
      setRows(rs => { const have = new Set(rs.map(r => r.id)); return [...rs, ...(fresh as TimesheetRowType[]).filter(r => !have.has(r.id))].sort((a, b) => a.work_date.localeCompare(b.work_date)) })
    } catch (e: unknown) { setWeekendsOn(false); setError(errMsg(e, 'Could not add weekend days')) } finally { setWeekendBusy(false) }
  }
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const payDate = getPayDate(period)
  const today = todayET()
  const statusBadge: { label: string; cls: string } | null =
    sheetTags.length > 0 ? null // Returned / Closed etc. already show as tags next to it
    : timesheet.status === 'approved' ? { label: '✓ Approved', cls: 'bg-emerald-100 text-emerald-700' }
    : timesheet.status === 'submitted' ? { label: '⏳ Submitted', cls: 'bg-blue-100 text-blue-700' }
    : missing ? null : { label: '● Draft', cls: 'bg-slate-100 text-slate-600' }
  const daysLeft = Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000)
  const due: { headline: string; detail: string; cls: string; chip: string } =
    submitted ? { headline: 'Submitted ✓', detail: timesheet.status === 'approved' ? 'Approved' : 'Waiting on approval', cls: 'text-blue-700', chip: 'bg-blue-100 text-blue-800' }
    : daysLeft < 0 ? { headline: `Overdue by ${-daysLeft} day${daysLeft === -1 ? '' : 's'}`, detail: `Was due ${fmtDayLong(dueDate)}`, cls: 'text-red-700', chip: 'bg-red-100 text-red-800' }
    : daysLeft <= 3 ? { headline: daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, detail: fmtDayLong(dueDate), cls: 'text-amber-700', chip: 'bg-amber-100 text-amber-800' }
    : { headline: `Due ${fmtDayLong(dueDate)}`, detail: `in ${daysLeft} days`, cls: 'text-teal-700', chip: 'bg-[#e0f5f8] text-[#028a9e]' }
  /** Colour for one period's timesheet due date in the picker, from that period's own status. */
  function dueTone(periodDue: string, status: PeriodSummary['status'] | undefined) {
    if (status === 'submitted' || status === 'approved') return { text: 'text-blue-700', note: 'Submitted' }
    const left = Math.round((new Date(`${periodDue}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000)
    if (left < 0) return { text: 'text-red-700', note: 'Overdue' }
    if (left <= 3) return { text: 'text-amber-700', note: left === 0 ? 'Today' : `${left}d` }
    return { text: 'text-teal-700', note: '' }
  }
  const rowByDate = new Map(rows.map(r => [r.work_date, r]))
  const stripDays = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(period.start, i)
    const row = rowByDate.get(date)
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
    const hrs = row ? Number(row.regular_hours) + Number(row.leave_hours) + Number(row.holiday_hours ?? 0) : 0
    const isHoliday = !!row && Number(row.holiday_hours ?? 0) > 0
    const isLeave = !!row && Number(row.leave_hours) > 0
    const missingHours = !!row && !isWeekendDate(date) && !isHoliday && hrs === 0 && date < today
    const weekendHidden = !!row && isWeekendDate(date) && !weekendsOn
    const cls = !row || weekendHidden ? 'bg-[#f7fafb] border-[#e8f4f7]' // weekends have no row on the timesheet until switched on
      : isHoliday ? 'bg-rose-50 border-rose-200 [&>span:last-child]:text-rose-600'
      : isLeave ? 'bg-violet-50 border-violet-200 [&>span:last-child]:text-violet-600'
      : hrs > 0 ? 'bg-[#e6f7fa] border-[#b9e6ee] [&>span:last-child]:text-[#028a9e]'
      : missingHours ? 'bg-red-50/60 border-dashed border-red-200' : 'bg-white border-[#e8f4f7]'
    const label = isHoliday ? 'HOL' : isLeave ? 'Leave' : hrs > 0 ? `${hrs}h` : missingHours ? '—' : ''
    return { date, row, cls, label, dow: DOW_SHORT[dow], day: Number(date.slice(8)) }
  })
  function jumpToDay(date: string) {
    const el = document.getElementById(`ts-row-${date}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('!bg-[#d6f3f7]')
    window.setTimeout(() => el.classList.remove('!bg-[#d6f3f7]'), 1400)
  }
  const canSubmitNow = (onBehalf ? canSubmitOnBehalf : !submitted) && !closedForEdit
  function stickySubmit() {
    if (!signed) document.getElementById('ts-signature')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else handleSubmit()
  }


  return (
    <div>
      {stuck && !missing && (
        <div className="sticky top-0 z-30 h-0 no-print">
          <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-white/95 backdrop-blur border-b border-[#d4eef2] px-4 py-2 shadow-sm">
            <span className="flex-1 min-w-0 truncate text-[13px] font-bold text-[#0b2b35]">{fmtPeriodTitle(period)} · {total} / {TARGET_HOURS} hrs</span>
            <span className={`text-[12px] font-semibold hidden sm:inline ${due.cls}`}>{due.headline}</span>
            {canSubmitNow && <button onClick={stickySubmit} disabled={submitting} className="bg-[#02ACC0] text-white text-[12px] font-semibold px-3.5 py-1.5 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">{signed ? 'Submit & Sign' : 'Sign to submit'}</button>}
          </div>
        </div>
      )}
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
          {employeeName} · Employee ID {employeeIdLabel} · Community Housing Associates · Generated {fmtDate(todayET())}
        </p>
      </div>

      {onBehalf && editing && !missing && (
        <div className="no-print"><OnBehalfPanel edit employeeName={employeeName} actorName={onBehalf.actorName} what="timesheet" reasonCode={behalf.reasonCode} note={behalf.note} onChange={setBehalf} /></div>
      )}

      {onBehalf && !missing && !editing && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-sky-900">Read-only — you are viewing {employeeName}&rsquo;s timesheet</p>
            <p className="text-[12px] text-sky-800 mt-0.5">Nothing here changes unless you press <strong>Override / Edit</strong>. You will be asked for a reason, and every change is saved to the audit trail below{timesheet.status === 'draft' ? '. A draft can also be submitted on their behalf from edit mode' : ''}.</p>
          </div>
          <button onClick={() => setEditing(true)} disabled={loading}
            className="bg-amber-500 text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-40">✎ Override / Edit</button>
        </div>
      )}
      {onBehalf && editing && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <p className="text-[12px] text-amber-800 font-semibold">Edit mode is on{hasUnsaved ? ' — you have unsaved changes' : ''}.</p>
          <button onClick={exitEdit} disabled={loading} className="text-[13px] font-semibold px-4 py-2 rounded-lg border border-[#d4eef2] text-gray-600 hover:bg-white">{hasUnsaved ? 'Discard changes & exit' : 'Exit edit mode'}</button>
        </div>
      )}
      {closedBlocksOverride && editing && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 no-print">
          <p className="text-[13px] font-semibold text-red-800">This pay period is closed</p>
          <p className="text-[13px] text-red-700 mt-1">Accounting closed {closedHit ? fmtDateRange(closedHit.start, closedHit.end) : 'this period'}, so only the CEO can override it. Ask Nico to make the change or reopen the timesheet.</p>
        </div>
      )}
      {!missing && submittedBanner}

      {!onBehalf && closedForEdit && closedHit && (
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
          {people.length > 0 && (
            <div className="flex items-center gap-2 mb-2 no-print">
              <label htmlFor="ts-person" className="text-[11px] uppercase tracking-wide font-semibold text-gray-400">Employee</label>
              <select id="ts-person" value={employeeId} onChange={e => openPerson(e.target.value)} disabled={loading}
                className="text-[13px] text-[#0b2b35] font-semibold bg-white border border-[#d4eef2] rounded-lg px-2 py-1 focus:outline-none focus:border-[#02ACC0] disabled:opacity-50">
                <option value={selfId}>My timesheet</option>
                {people.filter(p => p.id !== selfId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                {/* A test account opened by link isn't in the roster; keep the picker showing who is on screen. */}
                {employeeId !== selfId && !people.some(p => p.id === employeeId) && <option value={employeeId}>{employeeName}</option>}
              </select>
            </div>
          )}
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Timesheet{onBehalf ? ` — for ${employeeName}` : ''}</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">{employeeName} · Employee ID {employeeIdLabel}</p>
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
          {(onBehalf ? editing && !missing : !submitted) && <button
            onClick={saveDraft}
            disabled={saveStatus === 'saving' || (!!onBehalf && (!hasUnsaved || !!behalfIssue || closedBlocksOverride))}
            className={`text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors border disabled:opacity-60 disabled:cursor-not-allowed ${
              saveStatus === 'error' ? 'border-red-200 text-red-500 hover:bg-red-50'
              : hasUnsaved ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
              : 'border-[#d4eef2] text-[#0b2b35] hover:bg-[#f0f7f8]'
            }`}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Retry Save' : hasUnsaved ? (onBehalf ? 'Save changes' : 'Save Now') : '✓ All changes saved'}
          </button>}
          {(onBehalf ? canSubmitOnBehalf : !submitted) && <button
            disabled={!signed || submitting || closedForEdit || !!behalfIssue}
            onClick={handleSubmit}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? 'Submitting…' : 'Submit & Sign'}
          </button>}
        </div>
      </div>

      <div ref={headerRef} className="relative bg-white rounded-2xl border border-[#d4eef2] mb-6 no-print max-w-[1010px]">
        <div className="flex flex-wrap items-center gap-3.5 px-4 py-3.5">
          <button onClick={() => switchPeriod(periodIdx + 1)} disabled={periodIdx >= periods.length - 1 || loading} aria-label="Previous (older) pay period" title="Previous pay period"
            className="w-10 h-10 rounded-[10px] border border-[#d4eef2] text-[20px] text-[#0b2b35] hover:bg-[#f0f7f8] hover:border-[#02ACC0] disabled:opacity-30 disabled:hover:bg-transparent transition-colors">‹</button>
          <button onClick={() => setPickerOpen(o => !o)} aria-haspopup="listbox" aria-expanded={pickerOpen} disabled={loading}
            className="text-left px-2.5 py-1 rounded-[10px] hover:bg-[#f0f7f8] transition-colors disabled:opacity-50">
            <span className="flex items-center gap-2 text-[18px] font-extrabold text-[#0b2b35]">{fmtPeriodTitle(period)}<span className="text-[10px] text-gray-400">▼</span></span>
            <span className="block text-[11px] text-gray-500 mt-px">{periodIdx === 0 ? 'This pay period' : `${periodIdx} pay period${periodIdx > 1 ? 's' : ''} ago`}</span>
          </button>
          <button onClick={() => switchPeriod(periodIdx - 1)} disabled={periodIdx === 0 || loading} aria-label="Next (newer) pay period" title="Next pay period"
            className="w-10 h-10 rounded-[10px] border border-[#d4eef2] text-[20px] text-[#0b2b35] hover:bg-[#f0f7f8] hover:border-[#02ACC0] disabled:opacity-30 disabled:hover:bg-transparent transition-colors">›</button>
          <div className="flex items-center gap-1.5 flex-wrap">
            {periodIdx === 0
              ? <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#e0f5f8] text-[#028a9e]">Current period</span>
              : <button onClick={() => switchPeriod(0)} className="text-[12px] font-bold text-[#028a9e] hover:underline">Jump to current →</button>}
            {statusBadge && <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${statusBadge.cls}`}>{statusBadge.label}</span>}
            <RowTags tags={sheetTags} dashWhenEmpty={false} />
          </div>
          <div className="ml-auto flex flex-col gap-1.5 items-end max-sm:ml-0 max-sm:items-start max-sm:w-full">
            <span className={`inline-flex items-baseline gap-1.5 rounded-lg px-2.5 py-1 ${due.chip}`} title="Timesheet due date">
              <span className="text-[10px] uppercase tracking-wide font-bold opacity-70">Timesheet</span>
              <span className="text-[13px] font-extrabold">{due.headline}</span>
              {due.detail && <span className="text-[11px] opacity-80">· {due.detail}</span>}
            </span>
            <span className="inline-flex items-baseline gap-1.5 rounded-lg px-2.5 py-1 bg-emerald-100 text-emerald-800" title="Direct deposit date">
              <span className="text-[10px] uppercase tracking-wide font-bold opacity-70">💵 Pay date</span>
              <span className="text-[13px] font-extrabold">{fmtDayLong(payDate)}</span>
            </span>
          </div>
        </div>
        <div className="px-4 pb-3.5">
          <div className="flex justify-between text-[12px] mb-1.5">
            <span><strong>{weekdayTotal}</strong> of {TARGET_HOURS} expected hours logged{weekendTotal > 0 && <span className="text-indigo-600 font-semibold"> · +{weekendTotal} weekend</span>}</span>
            <span className="text-gray-400 font-semibold">{pct}%</span>
          </div>
          <div className="h-2 bg-[#e8f4f7] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : pct === 100 ? 'bg-emerald-500' : 'bg-[#02ACC0]'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-7 sm:grid-cols-14 gap-1 px-4 pt-3 pb-4 border-t border-[#eef6f8]">
          {stripDays.map(d => (
            <button type="button" key={d.date} onClick={() => jumpToDay(d.date)} disabled={!d.row || (isWeekendDate(d.date) && !weekendsOn)} title={`${fmtDayLong(d.date)}${d.label ? ` · ${d.label}` : ''}`}
              className={`rounded-lg border py-1.5 text-center text-[10px] text-gray-500 transition-colors enabled:hover:border-[#02ACC0] ${d.cls} ${d.date === todayET() ? 'ring-2 ring-[#02ACC0]/30 !border-[#02ACC0]' : ''}`}>
              {d.dow}
              <span className="block text-[13px] font-bold text-[#0b2b35] my-px">{d.day}</span>
              <span className="block h-[13px] text-[10px] font-bold">{d.label}</span>
            </button>
          ))}
        </div>
        <p className="px-4 pb-3 -mt-1 text-[11px] text-gray-400">Filled = hours logged · purple = leave · rose = holiday · dashed = no hours yet. Click a day to jump to it.</p>
        {pickerOpen && (
          <div ref={pickerRef} role="listbox" className="absolute left-4 top-[72px] z-20 w-[min(420px,calc(100%-2rem))] bg-white border border-[#d4eef2] rounded-xl shadow-xl overflow-hidden">
            <div className="flex justify-between items-center px-3.5 py-2.5 border-b border-[#d4eef2]">
              <span className="text-[11px] uppercase tracking-wide font-bold text-gray-400">Pay periods</span>
              {periodIdx !== 0 && <button onClick={() => { setPickerOpen(false); switchPeriod(0) }} className="text-[12px] font-bold text-[#028a9e] hover:underline">Jump to current</button>}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {periods.map((p, i) => {
                // The period on screen uses its live state; the others come from the summary query.
                const sm = summaries?.find(x => x.start === p.start)
                const live: PeriodSummary['status'] | undefined = i === periodIdx ? (missing ? 'none' : timesheet.status === 'draft' && timesheet.return_reason ? 'returned' : timesheet.status as PeriodSummary['status']) : sm?.status
                const hrs = i === periodIdx ? total : sm?.hours
                const tone = dueTone(getTimesheetDueDate(p), live)
                const needsAttention = live === 'returned' || tone.note === 'Overdue'
                const pill = live === 'approved' ? ['✓ Approved', 'bg-emerald-100 text-emerald-700'] : live === 'submitted' ? ['⏳ Submitted', 'bg-blue-100 text-blue-700'] : live === 'returned' ? ['↩ Returned', 'bg-amber-100 text-amber-700'] : live === 'draft' ? ['● Draft', 'bg-slate-100 text-slate-600'] : live === 'none' ? ['Not started', 'bg-gray-100 text-gray-500'] : ['…', 'bg-gray-100 text-gray-400']
                return (
                  <button key={p.start} role="option" aria-selected={i === periodIdx} onClick={() => { setPickerOpen(false); switchPeriod(i) }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#f0f7f8] text-left hover:bg-[#f0fbfc] ${i === periodIdx ? 'bg-[#f0fbfc]' : ''}`}>
                    <span className={`w-[92px] flex-shrink-0 text-center text-[10px] font-bold px-2 py-1 rounded-full ${pill[1]}`}>{pill[0]}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold text-[#0b2b35]">{fmtPeriodTitle(p)}{i === 0 ? ' · current' : ''}</span>
                      <span className="flex flex-wrap gap-x-2.5 text-[11px]">
                        <span className={`font-semibold ${tone.text}`}>Due {fmtDayLong(getTimesheetDueDate(p))}{tone.note && ` · ${tone.note}`}</span>
                        <span className="font-semibold text-emerald-700">💵 {fmtDayLong(getPayDate(p))}</span>
                      </span>
                    </span>
                    {needsAttention && <span className="text-[10px] font-bold text-red-600 whitespace-nowrap">⚠ Needs attention</span>}
                    <span className="w-10 text-right text-[12px] font-bold text-[#0b2b35]">{hrs === undefined ? '' : `${hrs}h`}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      {missing ? (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-6 max-w-2xl no-print">
          <p className="text-[14px] font-bold text-[#0b2b35]">No timesheet for this pay period</p>
          <p className="text-[13px] text-gray-500 mt-1">{employeeName} has no timesheet for {formatPeriodLabel(period)} yet. Creating one makes an empty draft you can then complete on their behalf (Override / Edit → sign → submit).</p>
          <button onClick={createSheet} disabled={loading} className="mt-4 bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">{loading ? 'Creating…' : 'Create timesheet'}</button>
        </div>
      ) : (<>
      {isSalaried && !onBehalf && (
        <div className="bg-[#f8fcfd] border border-[#d4eef2] text-[#0b2b35] text-[12px] rounded-lg px-4 py-2.5 mb-4 no-print max-w-[1010px]">
          Regular hours fill in as each workday arrives (8 a day, up to today — future days stay empty); scheduled holidays show right away as <strong>Holiday</strong> hours instead, so a complete pay period totals {TARGET_HOURS} hrs. The <strong>Leave</strong> column fills in automatically from your leave requests — <Link href="/request" className="text-[#028a9e] font-semibold hover:underline">request leave</Link> to take time off (sick leave is approved instantly when your balance covers it), and <strong>Regular</strong> adjusts so each day still totals 8.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 max-w-[1010px]">
        {[
          { label: 'Regular', value: `${totalReg} hrs`, color: 'text-[#0b2b35]' },
          { label: 'Leave', value: `${totalLeave} hrs`, color: 'text-violet-600' },
          { label: 'Holiday', value: `${totalHoliday} hrs`, color: 'text-rose-500' },
          { label: 'Total', value: weekendTotal > 0 ? `${total}` : `${total} / ${TARGET_HOURS}`, color: over ? 'text-red-500' : 'text-[#0b2b35]' },
          { label: 'Remaining', value: over ? 'Over by ' + (weekdayTotal - TARGET_HOURS) + ' hrs' : `${remaining} hrs`, color: over ? 'text-red-500' : remaining === 0 ? 'text-emerald-600' : 'text-amber-600' },
          ...(weekendTotal > 0 ? [{ label: 'Weekend', value: `${weekendTotal} hrs`, color: 'text-indigo-600' }] : []),
          ...(weeklyGross !== null ? [{ label: 'Weekly Gross Wages', value: currency(weeklyGross), color: 'text-[#0b2b35]' }] : []),
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-[22px] font-black leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-2 no-print max-w-[1010px]">
        <button type="button" role="switch" aria-checked={weekendsOn} onClick={toggleWeekends} disabled={weekendBusy || loading || (!weekendsOn && !weekendRowsExist && !canAddWeekend)}
          className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#0b2b35] disabled:opacity-40">
          <span className={`relative w-9 h-5 rounded-full transition-colors ${weekendsOn ? 'bg-[#02ACC0]' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${weekendsOn ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
          {weekendBusy ? 'Adding weekend days…' : 'Show weekend days'}
        </button>
        <span className="text-[11px] text-gray-400">{weekendsOn ? 'Enter hours for any weekend day you worked. Unused weekend days are removed when you submit.' : 'Turn on if you worked a Saturday or Sunday this period.'}</span>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6 max-w-[1010px]">
        <div className="overflow-x-auto">
        <div className="min-w-[930px]">
        <div className="grid grid-cols-[90px_260px_180px_56px_56px_56px_60px_100px] gap-2 px-5 py-2.5 bg-[#f9fefe] border-b border-[#d4eef2]">
          {['Date', 'Description / Project', 'Tags', 'Regular', 'Leave', 'Holiday', 'Total'].map((h, i) => (
            <span key={h} className={`uppercase text-gray-400 font-semibold ${i >= 3 ? 'text-center text-[9px] tracking-wider' : 'text-[10px] tracking-widest'}`}>{h}</span>
          ))}
          <span />
        </div>

        <div className="px-5 py-2 bg-[#fafefe] border-b border-[#e8f4f7]">
          <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week 1</span>
        </div>
        {week1.map(row => <TimesheetRowView key={row.id} row={row} tags={tagsById.get(row.id) ?? []} allTags={customTags} onUpdate={updateRow} isSalaried={isSalaried} locked={readOnly} overrideRegular={!!onBehalf && !readOnly} leaveForEmployeeId={onBehalf?.employeeId} />)}
        <div className="grid grid-cols-[90px_260px_180px_56px_56px_56px_60px_100px] gap-2 px-5 py-2 bg-[#f9fefe] border-b-2 border-[#d4eef2] text-[12px]">
          <span className="text-gray-400 col-span-6 text-right font-semibold">
            Week 1 subtotal{weeklyGross !== null && <span className="text-gray-400 font-normal"> · {currency(weeklyGross)} gross</span>}
          </span>
          <span className="text-center font-bold text-[#0b2b35]">{week1Total} hrs</span>
          <span />
        </div>

        <div className="px-5 py-2 bg-[#fafefe] border-b border-[#e8f4f7]">
          <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week 2</span>
        </div>
        {week2.map(row => <TimesheetRowView key={row.id} row={row} tags={tagsById.get(row.id) ?? []} allTags={customTags} onUpdate={updateRow} isSalaried={isSalaried} locked={readOnly} overrideRegular={!!onBehalf && !readOnly} leaveForEmployeeId={onBehalf?.employeeId} />)}
        <div className="grid grid-cols-[90px_260px_180px_56px_56px_56px_60px_100px] gap-2 px-5 py-2 bg-[#f9fefe] border-t border-[#d4eef2] text-[12px]">
          <span className="text-gray-400 col-span-6 text-right font-semibold">
            Week 2 subtotal{weeklyGross !== null && <span className="text-gray-400 font-normal"> · {currency(weeklyGross)} gross</span>}
          </span>
          <span className="text-center font-bold text-[#0b2b35]">{week2Total} hrs</span>
          <span />
        </div>

        <div className="grid grid-cols-[90px_260px_180px_56px_56px_56px_60px_100px] gap-2 px-5 py-3.5 bg-[#f0f7f8] border-t-2 border-[#d4eef2] text-[13px]">
          <span className="font-bold text-[#0b2b35]">Totals</span>
          <span />
          <span />
          <span className="text-center font-bold text-[#0b2b35]">{totalReg}</span>
          <span className="text-center font-bold text-violet-600">{totalLeave}</span>
          <span className="text-center font-bold text-rose-500">{totalHoliday}</span>
          <span className="text-center font-bold text-[#0b2b35]">{weekendTotal > 0 ? total : `${total} / ${TARGET_HOURS}`}</span>
          <span />
        </div>
        </div>
        </div>
      </div>

      {/* Expenses this period */}
      <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-3.5 mb-6 no-print flex items-center gap-4 flex-wrap max-w-[1010px]">
        <div className="mr-auto">
          <p className="text-[13px] font-bold text-[#0b2b35]">Expenses this period</p>
          <p className="text-[12px] text-gray-400">{expenses.length} submitted · ${expenseTotal.toFixed(2)} total</p>
        </div>
        {!onBehalf && <Link href="/expenses" className="border border-[#d4eef2] text-[#028a9e] text-[12px] font-semibold px-3.5 py-1.5 rounded-lg hover:bg-[#e0f5f8] transition-colors whitespace-nowrap">+ Add Expense</Link>}
      </div>

      {submitted ? <TimesheetSignatures timesheet={timesheet} audit={audit} employeeName={employeeName} employeeIdLabel={employeeIdLabel} /> : audit.events.length > 0 && <TimesheetHistory audit={audit} title="Audit trail" />}

      {(onBehalf ? canSubmitOnBehalf : !submitted) && <div className="bg-white border border-[#d4eef2] rounded-xl p-4 sm:p-6 max-w-2xl">
        <p className="text-[14px] font-bold text-[#0b2b35] mb-0.5">{onBehalf ? `Administrator Certification & Signature (on behalf of ${employeeName})` : 'Employee Certification & Signature'}</p>
        <p className="text-[12px] text-gray-400 mb-5">
          {onBehalf ? timesheetOnBehalfAttestation(employeeName) : TIMESHEET_ATTESTATION}
        </p>

        <div id="ts-signature" />
        {!signed && <div role="alert" className="text-[13px] bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5 mb-3"><strong>Electronic signature required.</strong> Click the box below to sign before this timesheet can be submitted. The Submit button stays disabled until you do.</div>}
        <div
          onClick={() => setSigned(true)}
          className={`rounded-xl border-2 border-dashed px-6 py-4 cursor-pointer transition-colors text-center mb-4 ${
            signed ? 'border-emerald-400 bg-emerald-50' : 'border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f8fcfd]'
          }`}>
          {signed ? (
            <div>
              <p className="font-[cursive] text-[22px] text-[#0b2b35] mb-1">{onBehalf ? onBehalf.actorName : employeeName}</p>
              <p className="text-[11px] text-gray-400">{onBehalf ? `${onBehalf.actorName} on behalf of ${employeeName}` : employeeName} · Employee ID {employeeIdLabel} · Signed {fmtDate(todayET())}</p>
            </div>
          ) : (
            <p className="text-gray-400 text-[13px]">Click here to sign (required)</p>
          )}
        </div>

        {signed && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <span>✓</span>
            <span>Signature applied — submit below to send for approval.</span>
          </div>
        )}

        {/* Submit lives here as well as at the top of the page, so it's right where you've just signed. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 no-print">
          <button
            disabled={!signed || submitting || closedForEdit || !!behalfIssue}
            onClick={handleSubmit}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? 'Submitting…' : onBehalf ? `Submit on behalf of ${employeeName.split(' ')[0]}` : 'Submit & Sign'}
          </button>
          {!signed && <span className="text-[12px] text-amber-700 font-semibold">Sign above to enable submitting.</span>}
          {signed && behalfIssue && <span className="text-[12px] text-red-600">{behalfIssue}</span>}
        </div>
        {error && <p className="mt-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </div>}
      </>)}
    </div>
  )
}

function TimesheetRowView({ row, tags, allTags, onUpdate, isSalaried, locked, overrideRegular, leaveForEmployeeId }: { row: EditableRow; tags: RowTag[]; allTags: TimesheetTag[]; onUpdate: (id: string, patch: Partial<EditableRow>) => void; isSalaried: boolean; locked: boolean; /** A manual override: Regular hours can be typed even for salaried staff. */ overrideRegular?: boolean; leaveForEmployeeId?: string }) {
  const isLeave = Number(row.leave_hours) > 0
  const isHoliday = tags.some(t => t.key === 'holiday')
  const isWeekend = isWeekendDate(row.work_date)
  const rowTotal = Number(row.regular_hours) + Number(row.leave_hours) + Number(row.holiday_hours ?? 0)
  const isEmpty = rowTotal === 0 && !isHoliday && !isWeekendDate(row.work_date)
  const d = new Date(`${row.work_date}T00:00:00`)
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
  const dayShort = fmtDateShort(d)

  return (
    <div id={`ts-row-${row.work_date}`} className={`grid grid-cols-[90px_260px_180px_56px_56px_56px_60px_100px] gap-2 px-5 py-2.5 border-b border-[#f0f7f8] items-center text-[13px] transition-colors ${
      isHoliday ? 'bg-rose-50/40' : isLeave ? 'bg-violet-50/40' : isWeekend ? 'bg-indigo-50/40' : isEmpty ? 'bg-amber-50/30' : ''
    }`}>
      <div>
        <p className="font-semibold text-[#0b2b35] text-[12px]">{dayName}{isWeekend && <span className="ml-1 text-[9px] font-bold text-indigo-600 uppercase">wknd</span>}</p>
        <p className="text-[10px] text-gray-400">{dayShort}</p>
      </div>
      <div className="flex flex-col gap-1">
        <input
          value={row.description || ''}
          onChange={e => onUpdate(row.id, { description: e.target.value })}
          disabled={locked}
          placeholder="Add description…"
          className="flex-1 px-2 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white"
        />
        {isHoliday && isSalaried && (
          <label className="flex items-center gap-1.5 text-[10px] text-rose-600" title="Only if CHA asked you to work this holiday. Exempt staff earn flex time (1.5 × hours worked); non-exempt staff are paid time-and-a-half.">
            Worked this holiday at CHA&apos;s request:
            <input type="number" min={0} max={24} step={0.5} value={Number(row.holiday_worked_hours ?? 0) || ''} placeholder="0" disabled={locked}
              onChange={e => onUpdate(row.id, { holiday_worked_hours: Math.max(0, Math.min(24, Number(e.target.value))) })}
              className="w-12 text-center px-1 py-0.5 border border-rose-200 rounded text-[11px] bg-white disabled:bg-[#f9fefe]" /> hrs
          </label>
        )}
      </div>
      <div className="flex items-center"><TagsCell tags={tags} allTags={allTags} selectedIds={row.tag_ids ?? []} editable={!locked} onChange={ids => onUpdate(row.id, { tag_ids: ids })} /></div>
      {isSalaried && !overrideRegular && !isWeekend ? (
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
      <div className={`text-center font-bold ${rowTotal === 0 ? 'text-gray-300' : isWeekend ? 'text-indigo-600' : rowTotal === 8 ? 'text-emerald-600' : 'text-amber-600'}`}>
        {rowTotal > 0 ? rowTotal : '—'}
      </div>
      <div className="flex justify-end">
        {!locked && !isHoliday && !isWeekend && (
          <Link href={`/request?${leaveForEmployeeId ? `for=${leaveForEmployeeId}&` : ''}date=${row.work_date}`} title="Request leave for this day — approved leave fills in the Leave column"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-[#028a9e] border border-[#d4eef2] rounded-full pl-2.5 pr-1 py-0.5 hover:bg-[#e0f5f8] transition-colors">
            Add Leave
            <span aria-hidden className="w-[18px] h-[18px] rounded-full bg-[#02ACC0] text-white flex items-center justify-center text-[13px] leading-none">+</span>
          </Link>
        )}
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
