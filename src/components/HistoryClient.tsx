'use client'

import { errMsg } from '@/lib/user-error'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getLeaveAttachmentViewUrl, cancelMyLeaveRequest, cancelLeaveOnBehalf, adjustLeaveOnBehalf } from '@/app/actions/leave-requests'
import { fmtDate, fmtDateRange, fmtDaySet } from '@/lib/format-date'
import LeaveDaysList from '@/components/LeaveDaysList'
import LeaveRecordDetail from '@/components/LeaveRecordDetail'
import { todayET } from '@/lib/pay-periods'
import OnBehalfPanel from '@/components/OnBehalfPanel'
import { onBehalfProblem } from '@/lib/constants/on-behalf'
import type { LeaveRequest } from '@/types'

type Request = LeaveRequest & { approver_name: string | null }

const TYPE_STYLE: Record<string, { bar: string; badge: string }> = {
  PTO: { bar: 'bg-[#02ACC0]', badge: 'bg-[#e0f5f8] text-[#028a9e]' },
  Sick: { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700' },
  Personal: { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  Bereavement: { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  'Jury Duty': { bar: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700' },
  Voting: { bar: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700' },
  'Workers Comp': { bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' },
  Military: { bar: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
  Unpaid: { bar: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' },
  'Flex Time': { bar: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700' },
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function fmtRange(start: string, end: string, days?: { date: string }[]) {
  if (days && days.length > 0) return fmtDaySet(days.map(d => d.date))
  return start === end ? fmtDate(start) : fmtDateRange(start, end)
}

function daysAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30) return `${diff}d ago`
  if (diff < 365) return `${Math.round(diff / 30)}mo ago`
  return `${Math.floor(diff / 365)}yr ago`
}

// Mirrors cancelMyLeaveRequest: pending, auto-approved, or approved leave that hasn't started yet can be undone by the employee.
function canCancel(r: Request) {
  if (r.status === 'pending') return true
  return r.status === 'approved' && (!r.approver_id || r.start_date > todayET())
}

function RequestRow({ r, expanded, onToggle, allowCancel, adminCancel }: { r: Request; expanded: boolean; onToggle: () => void; allowCancel: boolean; adminCancel?: { employeeName: string; actorName: string } }) {
  const router = useRouter()
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [adminOpen, setAdminOpen] = useState<null | 'cancel' | 'edit'>(null)
  const [editHours, setEditHours] = useState<Record<string, string>>({})
  const [adjusted, setAdjusted] = useState('')
  const [behalf, setBehalf] = useState({ reasonCode: '', note: '' })

  async function cancel(e: React.MouseEvent) {
    e.stopPropagation()
    const taken = r.status === 'approved' && !!r.balance_deducted_at
    if (!window.confirm(`Cancel this ${r.leave_type} request for ${fmtRange(r.start_date, r.end_date, r.days)}?${taken ? ` The ${r.hours} hrs will go back to your balance and come off your timesheet.` : ''}`)) return
    setCancelling(true)
    setCancelError('')
    try {
      await cancelMyLeaveRequest(r.id)
      router.refresh()
    } catch (err) {
      setCancelError(errMsg(err, 'Could not cancel this request.'))
      setCancelling(false)
    }
  }
  async function adminCancelNow() {
    setCancelling(true)
    setCancelError('')
    try {
      await cancelLeaveOnBehalf(r.id, behalf)
      setAdminOpen(null)
      router.refresh()
    } catch (err) {
      setCancelError(errMsg(err, 'Could not cancel this request.'))
      setCancelling(false)
    }
  }
  const editableDays = (r.days && r.days.length > 0 ? r.days : [{ date: r.start_date, hours: Number(r.hours) }])
  function openEdit() {
    setEditHours(Object.fromEntries(editableDays.map(d => [d.date, String(d.hours)])))
    setCancelError('')
    setAdjusted('')
    setAdminOpen(o => (o === 'edit' ? null : 'edit'))
  }
  const editedDays = editableDays.map(d => ({ date: d.date, hours: Number(editHours[d.date] ?? d.hours) }))
  const editedTotal = Math.round(editedDays.reduce((t, d) => t + (Number.isFinite(d.hours) ? d.hours : 0), 0) * 100) / 100
  const editChanged = editedDays.some((d, i) => d.hours !== Number(editableDays[i].hours))
  const editInvalid = editedDays.some(d => !(d.hours > 0) || d.hours > 8)
  async function saveAdjust() {
    setCancelling(true)
    setCancelError('')
    try {
      const res = await adjustLeaveOnBehalf(r.id, editedDays, behalf)
      setAdjusted(`Saved: ${res.oldTotal} hrs → ${res.newTotal} hrs.${res.newBalance !== null ? ` Balance is now ${res.newBalance} hrs.` : ''}`)
      setAdminOpen(null)
      setCancelling(false)
      router.refresh()
    } catch (err) {
      setCancelError(errMsg(err, 'Could not adjust this request.'))
      setCancelling(false)
    }
  }
  const adminCanCancel = !!adminCancel && (r.status === 'pending' || r.status === 'approved')
  const tc = TYPE_STYLE[r.leave_type] || TYPE_STYLE.PTO
  const multiDay = (r.days?.length ?? 0) > 1
  const hasNote = !!(r.note || r.attachment_url || multiDay || (r.status === 'denied' && r.deny_reason) || (r.events?.length ?? 0) > 0)

  async function viewAttachment(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const url = await getLeaveAttachmentViewUrl(r.id)
      if (url) window.open(url, '_blank')
    } catch {
      // best-effort — no inline error UI in this row-based view
    }
  }

  return (
    <div>
      <div onClick={hasNote ? onToggle : undefined}
        className={`flex items-center gap-4 px-5 py-4 border-b border-[#f0f7f8] transition-colors ${hasNote ? 'cursor-pointer' : ''} ${expanded ? 'bg-[#f8fcfd]' : 'hover:bg-[#fafefe]'}`}>
        <div className={`w-1 h-12 rounded-full flex-shrink-0 ${tc.bar}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>{r.leave_type}</span>
            <span className="text-[13px] font-semibold text-[#0b2b35]">{fmtRange(r.start_date, r.end_date, r.days)}</span>
          </div>
          <p className="text-[11px] text-gray-400">
            {r.hours} hrs{multiDay ? ` · ${r.days!.length} days` : ''} · Submitted {daysAgo(r.created_at)}
            {r.submitted_by_name && <> · <span className="font-semibold text-amber-700">Submitted on the employee’s behalf by {r.submitted_by_name}</span></>}
            {r.approver_name && r.status !== 'denied' && <> · Reviewed · Approved by {r.approver_name}</>}
            {r.status === 'denied' && r.approver_name && <> · Reviewed · Denied by {r.approver_name}</>}
          </p>
          {cancelError && <p className="text-[11px] text-red-600 mt-1">{cancelError}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {allowCancel && canCancel(r) && (
            <button onClick={cancel} disabled={cancelling} className="text-[11px] font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-full disabled:opacity-50">
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
          {adminCanCancel && (
            <>
              <button onClick={e => { e.stopPropagation(); openEdit() }} className="text-[11px] font-semibold text-[#028a9e] border border-[#b6e3ea] hover:bg-[#e0f5f8] px-2.5 py-1 rounded-full">
                Edit hours
              </button>
              <button onClick={e => { e.stopPropagation(); setCancelError(''); setAdminOpen(o => (o === 'cancel' ? null : 'cancel')) }} className="text-[11px] font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-full">
                Cancel
              </button>
            </>
          )}
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span>
          {hasNote && <span className={`text-gray-300 text-[13px] transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>›</span>}
        </div>
      </div>

      {adjusted && <p role="status" className="px-6 py-2 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border-b border-emerald-100">{adjusted}</p>}
      {adminOpen === 'edit' && adminCancel && (
        <div className="bg-[#f8fcfd] border-b border-[#e8f4f7] px-6 py-4">
          <p className="text-[12px] text-gray-600 mb-3">Correct the hours for each day. The request stays in place: any balance already taken is adjusted by the difference, and the timesheet is updated to match.</p>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-[12px]">
            <span className="font-semibold text-[#0b2b35]">Set every day to</span>
            <input type="number" min="0.25" max="8" step="0.25" aria-label="Hours for every day" placeholder="hrs"
              onChange={e => { const v = e.target.value; if (v) setEditHours(Object.fromEntries(editableDays.map(d => [d.date, v]))) }}
              className="w-20 px-2 py-1.5 border border-[#d4eef2] rounded-lg focus:outline-none focus:border-[#02ACC0]" />
            <span className="text-gray-400">or edit days individually:</span>
          </div>
          <div className="rounded-lg border border-[#e8f4f7] bg-white max-w-sm mb-3">
            {editableDays.map(d => (
              <label key={d.date} className="flex items-center justify-between px-3 py-1.5 text-[12px] border-b border-[#f0f7f8] last:border-0">
                <span className="text-[#0b2b35]">{fmtDate(d.date)}</span>
                <span className="flex items-center gap-1.5">
                  <input type="number" min="0.25" max="8" step="0.25" value={editHours[d.date] ?? ''} onChange={e => setEditHours(h => ({ ...h, [d.date]: e.target.value }))}
                    className="w-20 px-2 py-1 border border-[#d4eef2] rounded-lg text-right focus:outline-none focus:border-[#02ACC0]" />
                  <span className="text-gray-400">hrs</span>
                </span>
              </label>
            ))}
            <div className="flex items-center justify-between px-3 py-1.5 text-[12px] bg-[#f8fcfd] font-semibold text-[#0b2b35]">
              <span>Total</span><span>{Number(r.hours)} hrs → {editedTotal} hrs</span>
            </div>
          </div>
          <OnBehalfPanel employeeName={adminCancel.employeeName} actorName={adminCancel.actorName} what="leave request" edit reasonCode={behalf.reasonCode} note={behalf.note} onChange={setBehalf} />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={saveAdjust} disabled={cancelling || !editChanged || editInvalid || !!onBehalfProblem(behalf)} className="text-[12px] font-semibold text-white bg-[#02ACC0] hover:bg-[#028a9e] px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              {cancelling ? 'Saving…' : 'Save corrected hours'}
            </button>
            <button onClick={() => setAdminOpen(null)} className="text-[12px] font-semibold border border-[#d4eef2] px-4 py-2 rounded-lg hover:bg-[#f0f7f8]">Close</button>
            {(!editChanged || editInvalid || onBehalfProblem(behalf)) && (
              <span className="text-[11px] text-amber-700">
                {!editChanged ? 'Change at least one day’s hours. ' : ''}{editInvalid ? 'Each day needs between 0.25 and 8 hours. ' : ''}{onBehalfProblem(behalf) ? 'Choose a reason code and add notes (10+ characters). ' : ''}
              </span>
            )}
          </div>
        </div>
      )}
      {adminOpen === 'cancel' && adminCancel && (
        <div className="bg-[#f8fcfd] border-b border-[#e8f4f7] px-6 py-4">
          <p className="text-[12px] text-gray-600 mb-3">This cancels the whole request. Any hours already taken off the balance go back, and they come off the timesheet. To correct hours instead, use <strong>Edit hours</strong>.</p>
          <OnBehalfPanel employeeName={adminCancel.employeeName} actorName={adminCancel.actorName} what="leave request" reasonCode={behalf.reasonCode} note={behalf.note} onChange={setBehalf} />
          <div className="flex gap-2">
            <button onClick={adminCancelNow} disabled={cancelling || !!onBehalfProblem(behalf)} className="text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              {cancelling ? 'Cancelling…' : 'Cancel this leave request'}
            </button>
            <button onClick={() => setAdminOpen(null)} className="text-[12px] font-semibold border border-[#d4eef2] px-4 py-2 rounded-lg hover:bg-[#f0f7f8]">Keep it</button>
          </div>
        </div>
      )}
      {expanded && (
        <div className="bg-[#f8fcfd] border-b border-[#e8f4f7] px-6 py-4 space-y-2">
          {multiDay && <LeaveDaysList days={r.days!} className="max-w-xs" />}
          {r.note && (
            <div className="flex gap-2.5">
              <div className="w-0.5 bg-[#d4eef2] rounded-full flex-shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Employee Note</p>
                <p className="text-[13px] text-gray-600 italic">&ldquo;{r.note}&rdquo;</p>
              </div>
            </div>
          )}
          {r.status === 'denied' && r.deny_reason && (
            <div className="flex gap-2.5">
              <div className="w-0.5 bg-red-200 rounded-full flex-shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-red-400 mb-1">Denial Reason</p>
                <p className="text-[13px] text-red-600">&ldquo;{r.deny_reason}&rdquo;</p>
              </div>
            </div>
          )}
          {r.attachment_url && (
            <button onClick={viewAttachment} className="flex items-center gap-1.5 text-[12px] font-semibold text-[#02ACC0] hover:underline">
              📎 {r.leave_type === 'Jury Duty' ? 'View summons' : 'View attachment'}
            </button>
          )}
          {(r.events?.length ?? 0) > 0 && (
            <LeaveRecordDetail events={r.events!} />
          )}
        </div>
      )}
    </div>
  )
}

export default function HistoryClient({
  initialRequests,
  title = 'My Leave Requests',
  subtitle = 'Full history of submitted requests',
  showNewRequestLink = true,
  adminCancel,
}: {
  initialRequests: Request[]
  title?: string
  subtitle?: string
  showNewRequestLink?: boolean
  /** Set when a named administrator is viewing another employee's history: shows an on-behalf Cancel with a reason code and notes. */
  adminCancel?: { employeeName: string; actorName: string }
}) {
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [expanded, setExpanded] = useState<string | null>(null)

  const requests = initialRequests
  const totalHrs = requests.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.hours), 0)
  const pending = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved').length
  const denied = requests.filter(r => r.status === 'denied').length
  const cancelled = requests.filter(r => r.status === 'cancelled').length
  const leaveTypes = ['All', ...Array.from(new Set(requests.map(r => r.leave_type)))]

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter !== 'All' && r.status !== statusFilter.toLowerCase()) return false
      if (typeFilter !== 'All' && r.leave_type !== typeFilter) return false
      return true
    })
  }, [requests, statusFilter, typeFilter])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">{title}</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        {showNewRequestLink && (
          <Link href="/request" className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">+ New Request</Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requests', value: requests.length, color: 'text-[#0b2b35]' },
          { label: 'Approved', value: approved, color: 'text-emerald-600' },
          { label: 'Pending', value: pending, color: 'text-amber-600' },
          { label: 'Hrs Approved', value: `${totalHrs} hrs`, color: 'text-[#02ACC0]' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-[26px] font-black leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1 bg-white border border-[#d4eef2] rounded-lg p-1">
          {[
            { label: 'All', count: requests.length },
            { label: 'Pending', count: pending },
            { label: 'Approved', count: approved },
            { label: 'Denied', count: denied },
            ...(cancelled > 0 ? [{ label: 'Cancelled', count: cancelled }] : []),
          ].map(t => (
            <button key={t.label} onClick={() => setStatusFilter(t.label)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors flex items-center gap-1.5 ${statusFilter === t.label ? 'bg-[#02ACC0] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'}`}>
              {t.label}
              <span className={`text-[10px] rounded-full px-1.5 ${statusFilter === t.label ? 'bg-white/20' : 'bg-gray-100'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-[#d4eef2] rounded-lg px-3 py-2 text-[13px] text-[#0b2b35] focus:outline-none focus:border-[#02ACC0] bg-white cursor-pointer">
          {leaveTypes.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-[13px] text-gray-400">No requests match this filter.</div>
        ) : (
          <div>
            {filtered.map(r => (
              <RequestRow key={r.id} r={r} allowCancel={showNewRequestLink} adminCancel={adminCancel} expanded={expanded === r.id} onToggle={() => setExpanded(prev => prev === r.id ? null : r.id)} />
            ))}
          </div>
        )}
        <div className="px-5 py-3 bg-[#fafefe] border-t border-[#f0f7f8] flex items-center justify-between">
          <p className="text-[12px] text-gray-400">Showing <strong className="text-[#0b2b35]">{filtered.length}</strong> of {requests.length} requests</p>
          <p className="text-[11px] text-gray-400">Click a row to expand notes</p>
        </div>
      </div>
    </div>
  )
}
