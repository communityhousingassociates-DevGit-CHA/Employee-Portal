'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createLeaveRequest, getTeamConflicts } from '@/app/actions/leave-requests'
import type { LeaveBalance, LeaveType } from '@/types'

type Conflict = { start_date: string; end_date: string; employee_name?: string }

const LEAVE_TYPES: { key: LeaveType; label: string; icon: string; desc: string; balanceKey: 'pto_hours' | 'sick_hours' | 'personal_hours' | null }[] = [
  { key: 'PTO', label: 'PTO / Vacation', icon: '🌴', desc: 'Paid time off', balanceKey: 'pto_hours' },
  { key: 'Sick', label: 'Sick Leave', icon: '🤒', desc: 'Illness or medical', balanceKey: 'sick_hours' },
  { key: 'Personal', label: 'Personal Day', icon: '🗓', desc: 'Personal business', balanceKey: 'personal_hours' },
  { key: 'Bereavement', label: 'Bereavement', icon: '🕊', desc: 'Loss of a family member', balanceKey: null },
  { key: 'Jury Duty', label: 'Jury Duty', icon: '⚖️', desc: 'Court summons required', balanceKey: null },
]

function workdaysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RequestClient({
  employeeName,
  employeeIdLabel,
  balance,
}: {
  employeeName: string
  employeeIdLabel: string
  balance: LeaveBalance | null
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>('PTO')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [signed, setSigned] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  const selectedType = LEAVE_TYPES.find(t => t.key === leaveType)!
  const selectedBalance = selectedType.balanceKey && balance ? Number(balance[selectedType.balanceKey]) : null

  useEffect(() => {
    if (!start || !end) { setConflicts([]); return }
    let cancelled = false
    getTeamConflicts(start, end).then(c => { if (!cancelled) setConflicts(c) }).catch(() => {})
    return () => { cancelled = true }
  }, [start, end])

  function suggestHours() {
    if (!start || !end) return
    setHours(String(workdaysBetween(start, end) * 8))
  }

  function handleEndChange(val: string) {
    setEnd(val)
    if (!hours && start && val) {
      const days = workdaysBetween(start, val)
      if (days > 0) setHours(String(days * 8))
    }
  }

  const hoursNum = Number(hours) || 0
  const balAfter = selectedBalance !== null ? selectedBalance - hoursNum : null
  const isNegative = balAfter !== null && balAfter < 0
  const canSubmit = signed && !!start && !!end && hoursNum > 0 && start <= end && !submitting

  const today = new Date().toISOString().slice(0, 10)

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      await createLeaveRequest({ leave_type: leaveType, start_date: start, end_date: end, hours: hoursNum, note })
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
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-2">Request Submitted</h2>
          <p className="text-[13px] text-gray-500 mb-1">
            <strong className="text-[#0b2b35]">{leaveType}</strong> · {start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`}
          </p>
          <p className="text-[12px] text-gray-400 mb-1">{employeeName} · Employee ID {employeeIdLabel}</p>
          <p className="text-[13px] text-gray-500 mb-6">A manager will be notified to review and approve.</p>
          <div className="flex flex-col gap-2">
            <Link href="/history" className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#028a9e] transition-colors">View My Requests</Link>
            <button onClick={() => { setSubmitted(false); setSigned(false); setStart(''); setEnd(''); setHours(''); setNote('') }}
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
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Request Leave</h1>
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
                const bal = t.balanceKey && balance ? Number(balance[t.balanceKey]) : null
                return (
                  <button key={t.key} onClick={() => { setLeaveType(t.key); setHours('') }}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${leaveType === t.key ? 'border-[#02ACC0] bg-[#f0fbfc]' : 'border-[#e8f4f7] hover:border-[#d4eef2]'}`}>
                    <div className="text-[18px] mb-1">{t.icon}</div>
                    <p className={`text-[12px] font-bold ${leaveType === t.key ? 'text-[#028a9e]' : 'text-[#0b2b35]'}`}>{t.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
                    {bal !== null && <p className={`text-[10px] font-semibold mt-1.5 ${leaveType === t.key ? 'text-[#02ACC0]' : 'text-gray-400'}`}>{bal} hrs avail.</p>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Dates &amp; Hours</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Start Date</label>
                <input type="date" value={start} min={today} onChange={e => { setStart(e.target.value); setSigned(false) }}
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">End Date</label>
                <input type="date" value={end} min={start || today} onChange={e => { handleEndChange(e.target.value); setSigned(false) }}
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0]" />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Total Hours</label>
                <input type="number" min="1" step="0.5" placeholder="e.g. 8" value={hours} onChange={e => { setHours(e.target.value); setSigned(false) }}
                  className="px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0]" />
              </div>
              {start && end && (
                <button onClick={suggestHours} className="px-4 py-2.5 border border-[#d4eef2] rounded-lg text-[12px] font-semibold text-[#02ACC0] hover:bg-[#f0f7f8] transition-colors whitespace-nowrap mb-0.5">
                  Auto-fill ({workdaysBetween(start, end) * 8} hrs)
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">Leave is taken in hourly increments · 8 hrs = 1 full day</p>
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Note to Approver <span className="normal-case font-normal">(optional)</span></p>
            <textarea rows={3} placeholder="Add any context…" value={note} onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] resize-none" />
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Employee Signature</p>
            <p className="text-[12px] text-gray-400 mb-4">By signing, you confirm this request is accurate and that leave requires approval before it is taken.</p>
            <div onClick={() => setSigned(true)}
              className={`rounded-xl border-2 border-dashed px-6 py-4 text-center cursor-pointer transition-all ${signed ? 'border-emerald-400 bg-emerald-50' : 'border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f8fcfd]'}`}>
              {signed ? (
                <div>
                  <p className="font-[cursive] text-[22px] text-[#0b2b35]">{employeeName}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{employeeName} · Employee ID {employeeIdLabel} · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
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

          {!canSubmit && (start || end || hoursNum > 0) && (
            <p className="text-[12px] text-gray-400">
              {!start || !end ? 'Select start and end dates.' : hoursNum === 0 ? 'Enter total hours.' : !signed ? 'Sign the form to enable submission.' : ''}
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
                    <div className="flex justify-between"><span className="text-gray-400">Current {leaveType}</span><span className="font-semibold text-[#0b2b35]">{selectedBalance} hrs</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">This request</span><span className="font-semibold text-red-500">− {hoursNum || 0} hrs</span></div>
                    <div className="border-t border-[#f0f7f8] pt-3 flex justify-between">
                      <span className="font-semibold text-[#0b2b35]">Remaining</span>
                      <span className={`font-bold text-[15px] ${isNegative ? 'text-red-500' : 'text-emerald-600'}`}>{balAfter !== null ? balAfter.toFixed(1) : '—'} hrs</span>
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
                  {isNegative && <div className="mt-3 text-[11px] bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2">Negative balance will require manager approval.</div>}
                </>
              ) : <p className="text-[12px] text-gray-400">{leaveType} does not draw from your leave balance.</p>}
            </div>
          </div>

          {start && end && (
            <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Request Summary</p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between"><span className="text-gray-400">Type</span><span className="font-semibold text-[#0b2b35]">{leaveType}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Dates</span><span className="font-semibold text-[#0b2b35] text-right">{start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Workdays</span><span className="font-semibold text-[#0b2b35]">{workdaysBetween(start, end)} day{workdaysBetween(start, end) !== 1 ? 's' : ''}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Hours</span><span className="font-semibold text-[#0b2b35]">{hoursNum || '—'}</span></div>
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
            {['Leave requires approval before it is taken.', 'PTO cap: 400 hrs. Anything above is forfeited.', 'Personal days reset January 1 each year.', 'Negative balances require manager approval.'].map(tip => (
              <div key={tip} className="flex gap-2 text-[11px] text-gray-500"><span className="text-[#02ACC0] flex-shrink-0 mt-0.5">·</span>{tip}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
