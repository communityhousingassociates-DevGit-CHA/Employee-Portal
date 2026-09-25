'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createLeaveRequest, getTeamConflicts, checkMyLeaveDays, getLeaveAttachmentUploadUrl } from '@/app/actions/leave-requests'
import { fmtDate } from '@/lib/format-date'
import type { LeaveBalance, LeaveType } from '@/types'
import { holidayOn } from '@/lib/holidays'
import { projectedAvailable, balanceTypeFor, type ReservedLeave } from '@/lib/leave-projection'
import { earliestLeaveDate, LEAVE_BACKDATE_DAYS, latestLeaveDate, latestSickLeaveDate } from '@/lib/leave-window'
import { todayET, deductThroughDate, getCurrentPeriod, closedRangeOverlapping, type ClosedRange } from '@/lib/pay-periods'
import { fmtHrs, halfHour } from '@/lib/format-hours'

type DayRow = { id: string; date: string; hours: string }
type Conflict = { start_date: string; end_date: string; employee_name?: string }

const LEAVE_TYPES: { key: LeaveType; label: string; icon: string; desc: string; balanceKey: 'pto_hours' | 'sick_hours' | 'personal_hours' | null }[] = [
  { key: 'PTO', label: 'PTO', icon: '🌴', desc: 'Personal time off', balanceKey: 'pto_hours' },
  { key: 'Sick', label: 'Sick Leave', icon: '🤒', desc: 'Illness or medical', balanceKey: 'sick_hours' },
  { key: 'Personal', label: 'Vacation', icon: '🗓', desc: 'Vacation time off', balanceKey: 'personal_hours' },
  { key: 'Bereavement', label: 'Bereavement', icon: '🕊', desc: 'Loss of a family member', balanceKey: null },
  { key: 'Jury Duty', label: 'Jury Duty', icon: '⚖️', desc: 'Court summons required', balanceKey: null },
]

function isWorkday(iso: string): boolean {
  const dow = new Date(`${iso}T00:00:00`).getDay()
  return dow !== 0 && dow !== 6 && !holidayOn(iso)
}

export default function RequestClient({
  employeeName,
  employeeIdLabel,
  balance,
  closedRanges,
  outlook,
}: {
  employeeName: string
  employeeIdLabel: string
  balance: LeaveBalance | null
  closedRanges: ClosedRange[]
  outlook: { hireDate: string; ptoUncapped: boolean; accrualsOn: boolean; reserved: ReservedLeave[] }
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>('PTO')
  // Days are picked on a timesheet-style grid: date -> hours. One request covers all of them; each day keeps its own hours.
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [viewStart, setViewStart] = useState(() => getCurrentPeriod(undefined, new Date(`${todayET()}T00:00:00Z`)).start)
  const days: DayRow[] = Object.keys(picked).sort().map(date => ({ id: date, date, hours: picked[date] }))
  const [note, setNote] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [signed, setSigned] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [autoApproved, setAutoApproved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [dayOverage, setDayOverage] = useState<string | null>(null)

  const selectedType = LEAVE_TYPES.find(t => t.key === leaveType)!
  const selectedBalance = selectedType.balanceKey ? Number(balance?.[selectedType.balanceKey] ?? 0) : null
  const attachmentRequired = leaveType === 'Jury Duty'

  const filledDays = days.filter(d => d.date)
  const dates = filledDays.map(d => d.date).sort()
  const start = dates[0] ?? ''
  const end = dates[dates.length - 1] ?? ''
  const dayKey = days.map(d => `${d.date}:${d.hours}`).join('|')

  useEffect(() => {
    if (!start || !end) { setConflicts([]); return }
    let cancelled = false
    getTeamConflicts(start, end).then(c => { if (!cancelled) setConflicts(c) }).catch(() => {})
    return () => { cancelled = true }
  }, [start, end])

  useEffect(() => {
    const ready = days.filter(d => d.date && Number(d.hours) > 0).map(d => ({ date: d.date, hours: Number(d.hours) }))
    if (ready.length === 0) { setDayOverage(null); return }
    let cancelled = false
    checkMyLeaveDays(ready).then(m => { if (!cancelled) setDayOverage(m) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey])

  function toggleDay(date: string) {
    setPicked(p => {
      const next = { ...p }
      if (date in next) delete next[date]
      else next[date] = '8'
      return next
    })
    setSigned(false)
  }

  function setDayHours(date: string, hours: string) {
    setPicked(p => ({ ...p, [date]: hours }))
    setSigned(false)
  }

  /** Selects every available weekday of the week at a full day, or clears them if they are all already selected. */
  function toggleWeek(weekDates: string[]) {
    const open = weekDates.filter(d => !unavailableReason(d))
    setPicked(p => {
      const next = { ...p }
      if (open.length > 0 && open.every(d => d in next)) open.forEach(d => delete next[d])
      else open.forEach(d => { if (!(d in next)) next[d] = '8' })
      return next
    })
    setSigned(false)
  }

  const hoursNum = days.reduce((sum, d) => sum + (d.date ? Number(d.hours) || 0 : 0), 0)
  const dayCount = days.filter(d => d.date && Number(d.hours) > 0).length
  // Leave that starts within the next two pay periods comes off today's balance when approved. Leave planned further out is
  // only reserved, so it is judged against the balance PROJECTED for its start date (accruals land in between, and other
  // reserved leave is already spoken for).
  const startsLater = !!start && start > deductThroughDate()
  const balType = balanceTypeFor(leaveType)
  const projection = startsLater && balType && selectedBalance !== null
    ? projectedAvailable({ type: balType, onDate: start, current: selectedBalance, reserved: outlook.reserved, hireDate: outlook.hireDate, ptoUncapped: outlook.ptoUncapped, accrualsOn: outlook.accrualsOn })
    : null
  const availableForRequest = projection ? projection.projected : selectedBalance
  const balAfter = availableForRequest !== null ? availableForRequest - hoursNum : null
  const isNegative = balAfter !== null && balAfter < 0
  const closedHit = days.map(d => d.date ? closedRangeOverlapping(d.date, d.date, closedRanges) : null).find(Boolean) ?? null

  const earliest = earliestLeaveDate()
  // Planned leave can be booked well ahead; sick leave can't (no one can schedule being sick).
  const latest = leaveType === 'Sick' ? latestSickLeaveDate() : latestLeaveDate()
  const beyondLatest = !!end && end > latest

  // Why a weekday can't be picked (null when it can).
  function unavailableReason(date: string): string | null {
    const holiday = holidayOn(date)
    if (holiday) return holiday
    if (date < earliest) return `More than ${LEAVE_BACKDATE_DAYS} days back`
    if (date > latest) return leaveType === 'Sick' ? 'Sick leave can’t be planned' : 'Too far ahead'
    if (closedRangeOverlapping(date, date, closedRanges)) return 'Period closed'
    return null
  }

  const viewDates = Array.from({ length: 14 }, (_, n) => {
    const d = new Date(`${viewStart}T00:00:00`)
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const viewWeeks = [viewDates.slice(0, 7), viewDates.slice(7)].map(w => w.filter(d => { const dow = new Date(`${d}T00:00:00`).getDay(); return dow !== 0 && dow !== 6 }))
  const viewEnd = viewDates[13]
  function shiftView(days: number) {
    const d = new Date(`${viewStart}T00:00:00`)
    d.setDate(d.getDate() + days)
    setViewStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  const badRows = days.some(d => !d.date || !isWorkday(d.date) || !(Number(d.hours) > 0) || Number(d.hours) > 8)
  const canSubmit = !closedHit && !dayOverage && !beyondLatest && !badRows && signed && !submitting && (!attachmentRequired || !!attachment)

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      let attachment_path: string | undefined
      if (attachment) {
        const { signedUrl, path } = await getLeaveAttachmentUploadUrl(attachment.name)
        const res = await fetch(signedUrl, { method: 'PUT', body: attachment, headers: { 'Content-Type': attachment.type } })
        if (!res.ok) throw new Error('Attachment upload failed — please try again')
        attachment_path = path
      }
      const result = await createLeaveRequest({ leave_type: leaveType, days: days.map(d => ({ date: d.date, hours: Number(d.hours) })), note, attachment_path })
      setAutoApproved(result.autoApproved)
      setSubmitted(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✅</div>
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-2">{autoApproved ? `${leaveType} Leave Recorded` : 'Request Submitted'}</h2>
          <p className="text-[13px] text-gray-500 mb-1">
            <strong className="text-[#0b2b35]">{leaveType}</strong> · {dayCount === 1 ? fmtDate(start) : `${dayCount} days (${fmtDate(start)} – ${fmtDate(end)})`}
          </p>
          <p className="text-[12px] text-gray-400 mb-1">{employeeName} · Employee ID {employeeIdLabel}</p>
          <p className="text-[13px] text-gray-500 mb-6">
            {autoApproved
              ? 'Approved automatically — your balance covers it. Your balance is updated and the days are on your timesheet.'
              : dayCount > 1 ? 'Your approvers have been notified and will review all the days together in the portal. You\u2019ll be notified of the decision.'
              : 'Your approvers have been notified by email and will review it in the portal. You\u2019ll be notified of the decision.'}
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/history" className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#028a9e] transition-colors">View My Requests</Link>
            <button onClick={() => { setSubmitted(false); setSigned(false); setPicked({}); setNote(''); setAttachment(null) }}
              className="text-[13px] text-[#02ACC0] font-semibold hover:underline">Submit another request</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Request / Use Leave</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Sent to a manager for approval</p>
          <p className="text-[12px] text-gray-400 mt-1">{employeeName} · Employee ID {employeeIdLabel}</p>
        </div>
        <Link href="/history" className="text-[13px] font-semibold text-gray-400 hover:text-[#0b2b35] transition-colors">View History →</Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Leave Type</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LEAVE_TYPES.map(t => {
                // A missing balance row means nothing has been loaded yet — show 0, not a blank card.
                const bal = t.balanceKey ? Number(balance?.[t.balanceKey] ?? 0) : null
                const isSel = leaveType === t.key
                const after = isSel && bal !== null && hoursNum > 0 ? bal - hoursNum : null
                return (
                  <button key={t.key} onClick={() => { setLeaveType(t.key) }}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${leaveType === t.key ? 'border-[#02ACC0] bg-[#f0fbfc]' : 'border-[#e8f4f7] hover:border-[#d4eef2]'}`}>
                    <div className="text-[18px] mb-1">{t.icon}</div>
                    <p className={`text-[12px] font-bold ${leaveType === t.key ? 'text-[#028a9e]' : 'text-[#0b2b35]'}`}>{t.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
                    {bal !== null && (
                      <div className="mt-2 pt-2 border-t border-[#e8f4f7]">
                        <p className={`text-[16px] font-black leading-none ${bal <= 0 ? 'text-red-500' : 'text-[#0b2b35]'}`}>
                          {fmtHrs(bal)} <span className="text-[10px] font-semibold text-gray-400">hrs available</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">≈ {(halfHour(bal) / 8).toFixed(1)} days</p>
                        {after !== null && (
                          <p className={`text-[10px] font-semibold mt-1 ${after < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {fmtHrs(after)} hrs after this request
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Dates &amp; Hours</p>
            <p className="text-[12px] text-gray-500 mb-4">
              Pick the days you&apos;ll be out, like a timesheet. Each day keeps its own hours (8 is a full day, 4 a half day), and everything you pick goes to your approver as <strong>one request</strong> — they see each day listed and approve or deny it together.
            </p>
            <div className="border border-[#d4eef2] rounded-xl overflow-hidden mb-3">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#f8fcfd] border-b border-[#d4eef2]">
                <button type="button" onClick={() => shiftView(-14)} disabled={viewEnd <= earliest}
                  className="text-[12px] font-semibold text-[#02ACC0] px-2 py-1 rounded-lg hover:bg-[#e0f5f8] disabled:opacity-30 disabled:hover:bg-transparent">‹ Prev</button>
                <div className="text-center">
                  <p className="text-[12px] font-bold text-[#0b2b35]">Pay period {fmtDate(viewStart)} – {fmtDate(viewEnd)}</p>
                  <button type="button" onClick={() => setViewStart(getCurrentPeriod(undefined, new Date(`${todayET()}T00:00:00Z`)).start)} className="text-[10px] text-gray-400 hover:text-[#02ACC0]">Jump to today</button>
                </div>
                <button type="button" onClick={() => shiftView(14)} disabled={viewStart > latest}
                  className="text-[12px] font-semibold text-[#02ACC0] px-2 py-1 rounded-lg hover:bg-[#e0f5f8] disabled:opacity-30 disabled:hover:bg-transparent">Next ›</button>
              </div>
              {viewWeeks.map((week, wi) => {
                const openDates = week.filter(d => !unavailableReason(d))
                const allOn = openDates.length > 0 && openDates.every(d => d in picked)
                return (
                  <div key={wi}>
                    <div className="flex items-center justify-between px-4 py-1.5 bg-[#f0f7f8] text-[10px] uppercase tracking-wide font-semibold text-gray-500">
                      <span>Week of {fmtDate(viewDates[wi * 7])}</span>
                      {openDates.length > 0 && (
                        <button type="button" onClick={() => toggleWeek(week)} className="normal-case text-[11px] text-[#028a9e] hover:underline">
                          {allOn ? 'Clear week' : 'Select full week'}
                        </button>
                      )}
                    </div>
                    {week.map(date => {
                      const reason = unavailableReason(date)
                      const on = date in picked
                      const label = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
                      return (
                        <div key={date} onClick={() => { if (!reason) toggleDay(date) }}
                          className={`flex items-center gap-4 px-4 py-2 border-b border-[#f0f7f8] last:border-0 ${reason ? 'opacity-50' : 'cursor-pointer hover:bg-[#fafefe]'} ${on ? 'bg-[#f0fbfc]' : ''}`}>
                          <input type="checkbox" checked={on} disabled={!!reason} onChange={() => toggleDay(date)} onClick={e => e.stopPropagation()} className="accent-[#02ACC0] w-4 h-4" />
                          <div className="w-28 text-[13px] text-[#0b2b35]"><span className="inline-block w-9 text-gray-400">{label}</span>{fmtDate(date)}</div>
                          {reason ? (
                            <span className="text-[11px] text-gray-400">{reason}</span>
                          ) : on ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <div className="relative">
                                <input type="number" min="0.5" max="8" step="0.5" value={picked[date]} onChange={e => setDayHours(date, e.target.value)}
                                  className="w-24 pl-3 pr-9 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">hrs</span>
                              </div>
                              {[['Full', '8'], ['Half', '4']].map(([lbl, hrs]) => (
                                <button key={lbl} type="button" onClick={() => setDayHours(date, hrs)}
                                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${picked[date] === hrs ? 'bg-[#e0f5f8] border-[#02ACC0] text-[#028a9e]' : 'border-[#d4eef2] text-gray-500 hover:bg-[#f0f7f8]'}`}>{lbl}</button>
                              ))}
                              {(Number(picked[date]) > 8 || !(Number(picked[date]) > 0)) && <span className="text-[11px] text-red-500">Enter 0.5–8 hrs</span>}
                            </div>
                          ) : <span className="text-[11px] text-gray-300">Click to add</span>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <p className="text-[12px] text-gray-500 mb-3">
              {dayCount === 0 ? 'No days selected yet.' : <><strong className="text-[#0b2b35]">{dayCount} day{dayCount === 1 ? '' : 's'}</strong> selected · <strong className="text-[#0b2b35]">{hoursNum} hrs</strong> total{dates.some(d => d < viewStart || d > viewEnd) ? ' (including other pay periods — use Prev/Next to review)' : ''}</>}
            </p>
            <p className="text-[11px] text-gray-400 -mt-2 mb-4">
              Request planned time off as far ahead as you like (through {fmtDate(latestLeaveDate())}). <strong>Sick leave</strong> can only be for today or earlier. You can also enter leave up to {LEAVE_BACKDATE_DAYS} days back (from {fmtDate(earliest)}) to catch your timesheet up.
            </p>
            {beyondLatest && (
              <div className="text-[11px] bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 mb-4">
                {leaveType === 'Sick'
                  ? 'Sick leave can’t be requested for future dates. Use PTO or Vacation for planned time off.'
                  : `Leave can be requested through ${fmtDate(latestLeaveDate())}.`}
              </div>
            )}
            {dayOverage && (
              <div className="text-[11px] bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 mb-4">{dayOverage}</div>
            )}
            {closedHit && (
              <div className="text-[11px] bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 mb-4">
                {fmtDate(closedHit.start)} – {fmtDate(closedHit.end)} has been closed by accounting, so no new leave can be entered for those dates. Choose different dates or contact your Accounting Manager.
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Note to Approver <span className="normal-case font-normal">(optional)</span></p>
            <textarea rows={3} placeholder="Add any context…" value={note} onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] resize-none" />
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">
              Attachment {attachmentRequired
                ? <span className="normal-case font-normal text-red-500">(required — attach the jury summons)</span>
                : <span className="normal-case font-normal">(optional)</span>}
            </p>
            <p className="text-[12px] text-gray-400 mb-3">
              {attachmentRequired ? 'Jury Duty requests need the summons attached before they can be submitted.' : 'e.g. a doctor’s note or other supporting document.'}
            </p>
            <button type="button" onClick={() => fileRef.current?.click()}
              className={`text-[13px] font-semibold px-3 py-2 rounded-lg border transition-colors w-fit ${
                attachmentRequired && !attachment ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-[#d4eef2] hover:bg-[#f0f7f8]'
              }`}>
              {attachment ? attachment.name : 'Attach File'}
            </button>
            {attachment && (
              <button type="button" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = '' }}
                className="ml-3 text-[11px] text-gray-400 hover:text-red-500">
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={e => setAttachment(e.target.files?.[0] ?? null)} />
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Employee Signature</p>
            <p className="text-[12px] text-gray-400 mb-4">By signing, you confirm this request is accurate and that leave requires approval before it is taken.</p>
            <div onClick={() => setSigned(true)}
              className={`rounded-xl border-2 border-dashed px-6 py-4 text-center cursor-pointer transition-all ${signed ? 'border-emerald-400 bg-emerald-50' : 'border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f8fcfd]'}`}>
              {signed ? (
                <div>
                  <p className="font-[cursive] text-[22px] text-[#0b2b35]">{employeeName}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{employeeName} · Employee ID {employeeIdLabel} · {fmtDate(new Date())}</p>
                </div>
              ) : <p className="text-gray-300 text-[13px]">Click here to sign</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <button disabled={!canSubmit} onClick={handleSubmit}
              className="bg-[#02ACC0] text-white text-[13px] font-semibold px-6 py-2.5 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <Link href="/history" className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#f0f7f8] transition-colors">Cancel</Link>
          </div>

          {!canSubmit && (start || hoursNum > 0) && (
            <p className="text-[12px] text-gray-400">
              {!start ? 'Pick a date.'
                : hoursNum === 0 ? 'Enter the hours for each day.'
                : attachmentRequired && !attachment ? 'Attach the jury summons to enable submission.'
                : !signed ? 'Sign the form to enable submission.' : ''}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#d4eef2]"><p className="text-[12px] font-bold text-[#0b2b35]">Balance Preview</p></div>
            <div className="p-4">
              {selectedBalance !== null ? (
                <>
                  <div className="space-y-3 text-[13px]">
                    <div className="flex justify-between"><span className="text-gray-400">Current {leaveType}</span><span className="font-semibold text-[#0b2b35]">{fmtHrs(selectedBalance)} hrs</span></div>
                    {projection && (
                      <>
                        <div className="flex justify-between"><span className="text-gray-400">+ Accruing by {fmtDate(start)}</span><span className="font-semibold text-emerald-600">+ {fmtHrs(projection.accrued)} hrs</span></div>
                        {projection.reservedBefore > 0 && <div className="flex justify-between"><span className="text-gray-400">− Already reserved</span><span className="font-semibold text-red-500">− {fmtHrs(projection.reservedBefore)} hrs</span></div>}
                        <div className="flex justify-between border-t border-[#f0f7f8] pt-2"><span className="text-gray-400">Projected on {fmtDate(start)}</span><span className="font-semibold text-[#0b2b35]">{fmtHrs(projection.projected)} hrs</span></div>
                      </>
                    )}
                    <div className="flex justify-between"><span className="text-gray-400">This request</span><span className="font-semibold text-red-500">− {hoursNum || 0} hrs</span></div>
                    <div className="border-t border-[#f0f7f8] pt-3 flex justify-between">
                      <span className="font-semibold text-[#0b2b35]">Remaining</span>
                      <span className={`font-bold text-[15px] ${isNegative ? 'text-red-500' : 'text-emerald-600'}`}>{balAfter !== null ? fmtHrs(balAfter) : '—'} hrs</span>
                    </div>
                  </div>
                  {hoursNum > 0 && (
                    <div className="mt-3">
                      <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${isNegative ? 'bg-red-400' : 'bg-[#02ACC0]'}`}
                          style={{ width: `${Math.max(0, Math.min(100, ((balAfter ?? 0) / (selectedBalance || 1)) * 100))}%` }} />
                      </div>
                    </div>
                  )}
                  {isNegative && <div className="mt-3 text-[11px] bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2">{projection ? `Your projected balance on ${fmtDate(start)} doesn’t cover this request, so it can’t be approved as is.` : 'Negative balance will require manager approval.'}</div>}
                  {startsLater && !isNegative && <div className="mt-3 text-[11px] bg-[#f0fbfc] border border-[#d4eef2] text-[#028a9e] rounded-lg px-3 py-2">Leave starting more than two pay periods out is <strong>reserved</strong> when approved. It comes off your balance once it is within two pay periods of the start date, and the projected balance above must actually be available then for the leave to be valid.{!outlook.accrualsOn && ' (Accruals aren’t switched on yet, so none are projected.)'}</div>}
                  {!startsLater && !!start && start > todayET() && !isNegative && hoursNum > 0 && balType && <div className="mt-3 text-[11px] bg-[#f0fbfc] border border-[#d4eef2] text-[#028a9e] rounded-lg px-3 py-2">This leave starts within the next two pay periods, so the hours come off your balance as soon as it is approved.</div>}
                  {leaveType === 'Sick' && hoursNum > 0 && !isNegative && <div className="mt-3 text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2">Sick leave is approved automatically when your balance covers it.</div>}
                </>
              ) : <p className="text-[12px] text-gray-400">{leaveType} does not draw from your leave balance.</p>}
            </div>
          </div>

          {start && (
            <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Request Summary</p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between"><span className="text-gray-400">Type</span><span className="font-semibold text-[#0b2b35]">{leaveType}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Requests</span><span className="font-semibold text-[#0b2b35]">{dayCount === 1 ? '1 day' : `${dayCount} days`} · one request</span></div>
                {[...days].filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date)).map(d => (
                  <div key={d.id} className="flex justify-between"><span className="text-gray-400">{fmtDate(d.date)}</span><span className="font-semibold text-[#0b2b35]">{Number(d.hours) || 0} hrs</span></div>
                ))}
                <div className="flex justify-between border-t border-[#f0f7f8] pt-2"><span className="text-gray-400">Total hours</span><span className="font-semibold text-[#0b2b35]">{hoursNum || '—'}</span></div>
              </div>
            </div>
          )}

          {start && end && (
            <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#d4eef2] flex items-center justify-between">
                <p className="text-[12px] font-bold text-[#0b2b35]">Team Coverage</p>
                {conflicts.length > 0
                  ? <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">{conflicts.length} also out</span>
                  : <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">All clear</span>}
              </div>
              <div className="p-4">
                {conflicts.length === 0 ? (
                  <p className="text-[12px] text-gray-400">No one else has approved or pending leave during this period.</p>
                ) : (
                  <div className="space-y-2">
                    {conflicts.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <span className="text-[#0b2b35] font-medium">{c.employee_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-[#f8fcfd] rounded-xl border border-[#e8f4f7] p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Policy Reminders</p>
            {['PTO, Vacation, Jury Duty, and Bereavement need approval before they are taken. Sick leave is approved automatically when your balance covers it.', 'PTO cap: 400 hrs. Anything above is forfeited.', 'Vacation days reset January 1 each year.', 'Negative balances require manager approval.'].map(tip => (
              <div key={tip} className="flex gap-2 text-[11px] text-gray-500"><span className="text-[#02ACC0] flex-shrink-0 mt-0.5">·</span>{tip}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
