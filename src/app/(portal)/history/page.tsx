'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { MOCK_REQUESTS } from '@/lib/mock-data'

type Request = typeof MOCK_REQUESTS[number]

const TYPE_STYLE: Record<string, { bar: string; badge: string }> = {
  PTO:         { bar: 'bg-[#02ACC0]', badge: 'bg-[#e0f5f8] text-[#028a9e]'  },
  Sick:        { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700' },
  Personal:    { bar: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700'   },
  Bereavement: { bar: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600'  },
  'Jury Duty': { bar: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700'     },
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-700',
  denied:   'bg-red-100 text-red-700',
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRange(start: string, end: string) {
  if (start === end) return fmtDate(start)
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end   + 'T00:00:00')
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.getDate()}, ${e.getFullYear()}`
  }
  return `${fmtDate(start)} – ${fmtDate(end)}`
}

function daysAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30)  return `${diff}d ago`
  if (diff < 365) return `${Math.round(diff / 30)}mo ago`
  return `${Math.floor(diff / 365)}yr ago`
}

function RequestRow({ r, expanded, onToggle }: { r: Request; expanded: boolean; onToggle: () => void }) {
  const tc = TYPE_STYLE[r.type] || TYPE_STYLE.PTO
  const hasNote = !!(r.note || (r.status === 'denied' && r.deny_reason))

  return (
    <div>
      <div
        onClick={hasNote ? onToggle : undefined}
        className={`flex items-center gap-4 px-5 py-4 border-b border-[#f0f7f8] transition-colors ${hasNote ? 'cursor-pointer' : ''} ${expanded ? 'bg-[#f8fcfd]' : 'hover:bg-[#fafefe]'}`}>

        {/* Type bar */}
        <div className={`w-1 h-12 rounded-full flex-shrink-0 ${tc.bar}`} />

        {/* Type + dates */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>{r.type}</span>
            <span className="text-[13px] font-semibold text-[#0b2b35]">{fmtRange(r.start, r.end)}</span>
          </div>
          <p className="text-[11px] text-gray-400">
            {r.hours} hrs · Submitted {daysAgo(r.submitted)}
            {r.approved_by && r.status !== 'denied' && <> · Approved by {r.approved_by}</>}
            {r.status === 'denied' && r.approved_by && <> · Reviewed by {r.approved_by}</>}
          </p>
        </div>

        {/* Status + expand caret */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[r.status]}`}>
            {r.status}
          </span>
          {hasNote && (
            <span className={`text-gray-300 text-[13px] transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>›</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="bg-[#f8fcfd] border-b border-[#e8f4f7] px-6 py-4 space-y-2">
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
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [typeFilter,   setTypeFilter]   = useState<string>('All')
  const [expanded,     setExpanded]     = useState<string | null>(null)

  const totalHrs   = MOCK_REQUESTS.filter(r => r.status === 'approved').reduce((s, r) => s + r.hours, 0)
  const pending    = MOCK_REQUESTS.filter(r => r.status === 'pending').length
  const approved   = MOCK_REQUESTS.filter(r => r.status === 'approved').length
  const denied     = MOCK_REQUESTS.filter(r => r.status === 'denied').length
  const leaveTypes = ['All', ...Array.from(new Set(MOCK_REQUESTS.map(r => r.type)))]

  const filtered = useMemo(() => {
    return MOCK_REQUESTS.filter(r => {
      if (statusFilter !== 'All' && r.status !== statusFilter.toLowerCase()) return false
      if (typeFilter   !== 'All' && r.type  !== typeFilter)                   return false
      return true
    })
  }, [statusFilter, typeFilter])

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">My Leave Requests</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Full history of submitted requests</p>
        </div>
        <Link href="/request"
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + New Request
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requests', value: MOCK_REQUESTS.length, color: 'text-[#0b2b35]' },
          { label: 'Approved',       value: approved,             color: 'text-emerald-600' },
          { label: 'Pending',        value: pending,              color: 'text-amber-600'   },
          { label: 'Hrs Approved',   value: `${totalHrs} hrs`,    color: 'text-[#02ACC0]'   },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-[26px] font-black leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex gap-1 bg-white border border-[#d4eef2] rounded-lg p-1">
          {[
            { label: 'All',      count: MOCK_REQUESTS.length },
            { label: 'Pending',  count: pending  },
            { label: 'Approved', count: approved },
            { label: 'Denied',   count: denied   },
          ].map(t => (
            <button
              key={t.label}
              onClick={() => setStatusFilter(t.label)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === t.label ? 'bg-[#02ACC0] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'
              }`}>
              {t.label}
              <span className={`text-[10px] rounded-full px-1.5 ${statusFilter === t.label ? 'bg-white/20' : 'bg-gray-100'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-[#d4eef2] rounded-lg px-3 py-2 text-[13px] text-[#0b2b35] focus:outline-none focus:border-[#02ACC0] bg-white cursor-pointer">
          {leaveTypes.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-[13px] text-gray-400">
            No requests match this filter.
          </div>
        ) : (
          <div>
            {filtered.map(r => (
              <RequestRow
                key={r.id}
                r={r}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(prev => prev === r.id ? null : r.id)}
              />
            ))}
          </div>
        )}

        <div className="px-5 py-3 bg-[#fafefe] border-t border-[#f0f7f8] flex items-center justify-between">
          <p className="text-[12px] text-gray-400">
            Showing <strong className="text-[#0b2b35]">{filtered.length}</strong> of {MOCK_REQUESTS.length} requests
          </p>
          <p className="text-[11px] text-gray-400">Click a row to expand notes</p>
        </div>
      </div>
    </div>
  )
}
