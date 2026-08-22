'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveLeaveRequest, denyLeaveRequest } from '@/app/actions/leave-requests'
import { approveExpense, denyExpense } from '@/app/actions/expenses'
import type { LeaveRequest, Expense } from '@/types'

type LeaveApproval = LeaveRequest & { employee_name: string; balance_current: number | null; balance_after: number | null }
type ExpenseApproval = Expense & { employee: { name: string; avatar_url: string | null } | { name: string; avatar_url: string | null }[] }

// Categories with underscores (rental_car, cash_advance, conference_fees) render wrong
// under CSS `capitalize` (e.g. "Rental_car") — map to real labels instead.
const CATEGORY_LABELS: Record<string, string> = {
  mileage: 'Mileage', hotel: 'Hotel', airline: 'Airline', meals: 'Meals', entertainment: 'Entertainment',
  cash_advance: 'Cash Advance', tolls: 'Tolls', conference_fees: 'Conference Fees', rental_car: 'Rental Car',
  gratuities: 'Gratuities', parking: 'Parking', other: 'Other',
}

const TYPE_STYLE: Record<string, { bar: string; badge: string }> = {
  PTO: { bar: 'bg-[#02ACC0]', badge: 'bg-[#e0f5f8] text-[#028a9e]' },
  Sick: { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700' },
  Personal: { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  Bereavement: { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  'Jury Duty': { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function daysAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

function daysUntil(iso: string) {
  const diff = Math.round((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000)
  if (diff < 0) return null
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff} days`
}

function LeaveApprovalCard({ item, onDecided }: { item: LeaveApproval; onDecided: () => void }) {
  const [confirming, setConfirming] = useState<'approve' | 'deny' | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const tc = TYPE_STYLE[item.leave_type] || TYPE_STYLE.Bereavement
  const until = daysUntil(item.start_date)
  const capPct = item.balance_after !== null ? Math.min(Math.round((item.balance_after / 400) * 100), 100) : 0
  const dateRange = item.start_date === item.end_date ? fmtDate(item.start_date) : `${fmtDate(item.start_date)} – ${fmtDate(item.end_date)}`

  async function submitApprove() {
    setBusy(true)
    setError('')
    try {
      await approveLeaveRequest(item.id)
      onDecided()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve')
      setBusy(false)
    }
  }

  async function submitDeny() {
    setBusy(true)
    setError('')
    try {
      await denyLeaveRequest(item.id, denyReason)
      onDecided()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to deny')
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#d4eef2] shadow-sm overflow-hidden">
      <div className={`h-1 ${tc.bar}`} />
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0 bg-[#02ACC0]">
              {item.employee_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <p className="font-bold text-[15px] text-[#0b2b35] leading-tight">{item.employee_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>{item.leave_type}</span>
                <span className="text-[11px] text-gray-400">Submitted {daysAgo(item.created_at)}</span>
                {until && <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-full">Starts {until}</span>}
              </div>
            </div>
          </div>
          {!confirming && (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setConfirming('deny')} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">Deny</button>
              <button onClick={() => setConfirming('approve')} className="text-[12px] font-semibold px-4 py-1.5 rounded-lg bg-[#02ACC0] text-white hover:bg-[#028a9e] transition-colors">✓ Approve</button>
            </div>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[12px] rounded-lg px-3 py-2 mb-3">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="sm:col-span-2 bg-[#f8fcfd] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Date Range</p>
            <p className="text-[14px] font-semibold text-[#0b2b35]">{dateRange}</p>
            <p className="text-[12px] text-gray-400 mt-0.5">{item.hours} hours requested</p>
          </div>
          <div className="bg-[#f8fcfd] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Balance After</p>
            {item.balance_after === null ? (
              <p className="text-[14px] font-semibold text-[#0b2b35]">No change</p>
            ) : (
              <>
                <p className={`text-[14px] font-semibold ${item.balance_after < 0 ? 'text-red-600' : 'text-[#0b2b35]'}`}>{item.balance_after} hrs</p>
                <div className="mt-1.5 bg-[#e8f4f7] rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-[#02ACC0] rounded-full" style={{ width: `${capPct}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{capPct}% of 400 hr cap</p>
              </>
            )}
          </div>
        </div>

        {item.note && (
          <div className="flex gap-2.5 mb-4">
            <div className="w-0.5 bg-[#d4eef2] rounded-full flex-shrink-0" />
            <p className="text-[13px] text-gray-500 italic">&ldquo;{item.note}&rdquo;</p>
          </div>
        )}

        {confirming === 'approve' && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-[13px] font-semibold text-emerald-800 mb-1">Confirm approval</p>
            <p className="text-[12px] text-emerald-700 mb-3">By confirming, you approve this request and its balance will be deducted.</p>
            <div className="flex gap-2">
              <button onClick={submitApprove} disabled={busy} className="bg-emerald-600 text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {busy ? 'Confirming…' : '✓ Confirm & Sign'}
              </button>
              <button onClick={() => setConfirming(null)} className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {confirming === 'deny' && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-[13px] font-semibold text-red-800 mb-1">Deny this request</p>
            <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} placeholder="Optional: add a reason for the employee…" rows={2}
              className="w-full text-[12px] border border-red-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-red-400 bg-white resize-none" />
            <div className="flex gap-2">
              <button onClick={submitDeny} disabled={busy} className="bg-red-500 text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
                {busy ? 'Confirming…' : '✕ Confirm Denial'}
              </button>
              <button onClick={() => { setConfirming(null); setDenyReason('') }} className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewedLeaveCard({ item }: { item: LeaveApproval }) {
  const tc = TYPE_STYLE[item.leave_type] || TYPE_STYLE.Bereavement
  const dateRange = item.start_date === item.end_date ? fmtDate(item.start_date) : `${fmtDate(item.start_date)} – ${fmtDate(item.end_date)}`
  return (
    <div className="bg-white rounded-xl border border-[#e8f4f7] opacity-70 overflow-hidden">
      <div className={`h-1 ${tc.bar}`} />
      <div className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-[14px] text-[#0b2b35]">{item.employee_name} <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>{item.leave_type}</span></p>
          <p className="text-[12px] text-gray-400 mt-0.5">{dateRange} · {item.hours} hrs</p>
          {item.status === 'denied' && item.deny_reason && <p className="text-[12px] text-red-500 mt-1">&ldquo;{item.deny_reason}&rdquo;</p>}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold flex-shrink-0 ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          <span>{item.status === 'approved' ? '✓' : '✕'}</span>
          <span className="capitalize">{item.status}</span>
        </div>
      </div>
    </div>
  )
}

function ExpenseCard({ item, onDecided }: { item: ExpenseApproval; onDecided: () => void }) {
  const [confirming, setConfirming] = useState<'approve' | 'deny' | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const employeeName = Array.isArray(item.employee) ? item.employee[0]?.name : item.employee?.name

  async function submitApprove() {
    setBusy(true); setError('')
    try { await approveExpense(item.id); onDecided() } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(false) }
  }
  async function submitDeny() {
    setBusy(true); setError('')
    try { await denyExpense(item.id, denyReason); onDecided() } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-[#d4eef2] shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-bold text-[15px] text-[#0b2b35]">{employeeName} — {CATEGORY_LABELS[item.category] ?? item.category}{item.miles ? ` (${item.miles} mi)` : ''}</p>
          <p className="text-[12px] text-gray-400 mt-0.5">{item.expense_date} · ${Number(item.amount).toFixed(2)}{item.description ? ` · ${item.description}` : ''}</p>
        </div>
        {!confirming && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setConfirming('deny')} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">Deny</button>
            <button onClick={() => setConfirming('approve')} className="text-[12px] font-semibold px-4 py-1.5 rounded-lg bg-[#02ACC0] text-white hover:bg-[#028a9e] transition-colors">✓ Approve</button>
          </div>
        )}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[12px] rounded-lg px-3 py-2 mb-3">{error}</div>}
      {confirming === 'approve' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex gap-2">
            <button onClick={submitApprove} disabled={busy} className="bg-emerald-600 text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">{busy ? 'Confirming…' : '✓ Confirm'}</button>
            <button onClick={() => setConfirming(null)} className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {confirming === 'deny' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} placeholder="Optional: reason…" rows={2}
            className="w-full text-[12px] border border-red-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-red-400 bg-white resize-none" />
          <div className="flex gap-2">
            <button onClick={submitDeny} disabled={busy} className="bg-red-500 text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">{busy ? 'Confirming…' : '✕ Confirm Denial'}</button>
            <button onClick={() => { setConfirming(null); setDenyReason('') }} className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApprovalsClient({
  approverName,
  initialPendingLeave,
  initialReviewedLeave,
  initialPendingExpenses,
}: {
  approverName: string
  initialPendingLeave: LeaveApproval[]
  initialReviewedLeave: LeaveApproval[]
  initialPendingExpenses: ExpenseApproval[]
}) {
  const router = useRouter()
  const [category, setCategory] = useState<'leave' | 'expenses'>('leave')
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')

  const pendingLeave = initialPendingLeave
  const reviewedLeave = initialReviewedLeave
  const pendingExpenses = initialPendingExpenses

  const totalHoursPending = pendingLeave.reduce((s, a) => s + Number(a.hours), 0)
  const oldest = pendingLeave.reduce<string | null>((min, a) => (!min || a.created_at < min ? a.created_at : min), null)

  function refresh() {
    router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Approvals</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{approverName}</p>
        </div>
        {category === 'leave' && pendingLeave.length > 0 && (
          <div className="flex gap-4 text-right flex-wrap">
            <div>
              <p className="text-[22px] font-black text-[#0b2b35] leading-none">{pendingLeave.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Pending</p>
            </div>
            <div>
              <p className="text-[22px] font-black text-amber-500 leading-none">{totalHoursPending}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Hours</p>
            </div>
            {oldest && (
              <div>
                <p className="text-[22px] font-black text-[#0b2b35] leading-none">{daysAgo(oldest)}</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-400">Oldest</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-white border border-[#d4eef2] rounded-lg p-1 w-fit mb-3">
        {([['leave', `Leave Requests (${pendingLeave.length})`], ['expenses', `Expenses (${pendingExpenses.length})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setCategory(key)}
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${category === key ? 'bg-[#0b2b35] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'}`}>
            {label}
          </button>
        ))}
      </div>

      {category === 'leave' && (
        <>
          <div className="flex gap-1 bg-white border border-[#d4eef2] rounded-lg p-1 w-fit mb-6">
            {([['pending', `Pending (${pendingLeave.length})`], ['reviewed', `Reviewed (${reviewedLeave.length})`]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${tab === key ? 'bg-[#02ACC0] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'pending' && (
            pendingLeave.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#d4eef2] p-14 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-semibold text-[#0b2b35] text-[15px]">All caught up</p>
                <p className="text-[13px] text-gray-400 mt-1">No pending leave approvals right now.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingLeave.map(a => <LeaveApprovalCard key={a.id} item={a} onDecided={refresh} />)}
              </div>
            )
          )}

          {tab === 'reviewed' && (
            reviewedLeave.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#d4eef2] p-14 text-center">
                <p className="text-[13px] text-gray-400">No decisions made yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviewedLeave.map(a => <ReviewedLeaveCard key={a.id} item={a} />)}
              </div>
            )
          )}
        </>
      )}

      {category === 'expenses' && (
        pendingExpenses.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#d4eef2] p-14 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold text-[#0b2b35] text-[15px]">All caught up</p>
            <p className="text-[13px] text-gray-400 mt-1">No pending expense approvals right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingExpenses.map(e => <ExpenseCard key={e.id} item={e} onDecided={refresh} />)}
          </div>
        )
      )}
    </div>
  )
}
