'use client'

import { useState, useMemo } from 'react'
import { MOCK_EMPLOYEES, MOCK_REPORT_ROWS } from '@/lib/mock-data'

// ── helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#02ACC0', '#7c3aed', '#0d9488', '#b45309',
  '#4f46e5', '#be185d', '#059669', '#9333ea',
]

function avatarColor(name: string) {
  const n = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function tenure(hire_date: string) {
  const start = new Date(hire_date + 'T00:00:00')
  const now   = new Date('2026-06-30')
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (months >= 24) {
    const yrs = Math.floor(months / 12)
    const mo  = months % 12
    return mo > 0 ? `${yrs} yr ${mo} mo` : `${yrs} yr`
  }
  return `${months} mo`
}

function fmtHireDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const DEPT_STYLE: Record<string, string> = {
  'Programs':        'bg-[#e0f5f8] text-[#028a9e]',
  'Client Services': 'bg-violet-50 text-violet-700',
  'Operations':      'bg-slate-100 text-slate-600',
  'Administration':  'bg-blue-50 text-blue-700',
  'Finance':         'bg-amber-50 text-amber-700',
  'Development':     'bg-emerald-50 text-emerald-700',
  'Technology':      'bg-indigo-50 text-indigo-700',
}

const TYPE_STYLE: Record<string, string> = {
  'Full-time':  'bg-emerald-50 text-emerald-700',
  'Part-time':  'bg-sky-50 text-sky-700',
  'Consultant': 'bg-gray-100 text-gray-600',
}

// ── expandable detail row ─────────────────────────────────────────────────────

function EmployeeDetail({ name }: { name: string }) {
  const bal = MOCK_REPORT_ROWS.find(r => r.name === name)
  if (!bal) return (
    <div className="px-6 py-4 bg-[#f8fcfd] border-t border-[#e8f4f7] text-[12px] text-gray-400">
      No leave balance data available yet.
    </div>
  )

  const capPct     = Math.min(Math.round((bal.pto_bal / 400) * 100), 100)
  const personalDays = Math.floor(bal.personal_bal / 8)
  const totalUsed  = bal.pto_used + bal.sick_used + bal.personal_used

  return (
    <div className="bg-[#f8fcfd] border-t border-[#e8f4f7] px-6 py-5">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Leave Balances — Current Period</p>
      <div className="grid grid-cols-3 gap-4">
        {/* PTO */}
        <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">PTO</p>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              +{bal.accrual}/pp
            </span>
          </div>
          <p className="text-[24px] font-black text-[#0b2b35] leading-none">{bal.pto_bal}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 mb-2">hrs available</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className={`h-full rounded-full ${capPct >= 75 ? 'bg-amber-400' : 'bg-[#02ACC0]'}`}
              style={{ width: `${capPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-400">{capPct}% of 400 hr cap{capPct >= 75 ? ' — approaching cap' : ''}</p>
          {bal.pto_used > 0 && <p className="text-[10px] text-gray-400 mt-1">{bal.pto_used} hrs used this period</p>}
        </div>

        {/* Sick */}
        <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Sick Leave</p>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              +3.69/pp
            </span>
          </div>
          <p className="text-[24px] font-black text-[#0b2b35] leading-none">{bal.sick_bal}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 mb-2">hrs available</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min((bal.sick_bal / 50) * 100, 100)}%` }} />
          </div>
          <p className="text-[10px] text-gray-400">No annual cap</p>
          {bal.sick_used > 0 && <p className="text-[10px] text-gray-400 mt-1">{bal.sick_used} hrs used this period</p>}
        </div>

        {/* Personal */}
        <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Personal Days</p>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
              Resets Jan 1
            </span>
          </div>
          <p className="text-[24px] font-black text-[#0b2b35] leading-none">{personalDays}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 mb-2">days remaining ({bal.personal_bal} hrs)</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(bal.personal_bal / 24) * 100}%` }} />
          </div>
          <p className="text-[10px] text-gray-400">{bal.personal_bal} / 24 hrs</p>
          {bal.personal_used > 0 && <p className="text-[10px] text-gray-400 mt-1">{bal.personal_used} hrs used this period</p>}
        </div>
      </div>

      {totalUsed > 0 && (
        <p className="text-[11px] text-gray-400 mt-4">
          Total leave used this pay period: <strong className="text-[#0b2b35]">{totalUsed} hrs</strong>
        </p>
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [search,    setSearch]    = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [showInactive, setShowInactive] = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const active   = MOCK_EMPLOYEES.filter(e => e.status === 'active')
  const fullTime = active.filter(e => e.type === 'Full-time').length
  const partTime = active.filter(e => e.type === 'Part-time').length
  const consult  = active.filter(e => e.type === 'Consultant').length
  const inactive = MOCK_EMPLOYEES.filter(e => e.status === 'inactive').length

  const filtered = useMemo(() => {
    return MOCK_EMPLOYEES.filter(e => {
      if (!showInactive && e.status === 'inactive') return false
      if (typeFilter !== 'All' && e.type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q) || e.dept.toLowerCase().includes(q)
      }
      return true
    })
  }, [search, typeFilter, showInactive])

  function toggleExpand(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Employees</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Community Housing Associates staff roster</p>
        </div>
        <button className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Add Employee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active',      value: active.length,  color: 'text-[#0b2b35]'   },
          { label: 'Full-time',   value: fullTime,        color: 'text-emerald-600' },
          { label: 'Part-time',   value: partTime,        color: 'text-sky-600'     },
          { label: 'Consultants', value: consult,         color: 'text-gray-500'    },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-[28px] font-black leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px]">🔍</span>
          <input
            type="text"
            placeholder="Search by name, title, or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-[#d4eef2] rounded-lg text-[13px] text-[#0b2b35] placeholder-gray-400 focus:outline-none focus:border-[#02ACC0] bg-white"
          />
        </div>
        <div className="flex gap-1 bg-white border border-[#d4eef2] rounded-lg p-1">
          {['All', 'Full-time', 'Part-time', 'Consultant'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                typeFilter === t ? 'bg-[#02ACC0] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowInactive(v => !v)}
          className={`text-[12px] font-medium px-3 py-2 rounded-lg border transition-colors ${
            showInactive
              ? 'bg-gray-100 border-gray-300 text-gray-700'
              : 'border-[#d4eef2] text-gray-400 hover:bg-[#f0f7f8]'
          }`}>
          {showInactive ? `Hide inactive` : `Show inactive (${inactive})`}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#d4eef2] flex items-center justify-between">
          <p className="text-[12px] text-gray-400">
            Showing <strong className="text-[#0b2b35]">{filtered.length}</strong> employee{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-[13px]">
            No employees match your search.
          </div>
        ) : (
          <div className="divide-y divide-[#f0f7f8]">
            {filtered.map(e => {
              const isExpanded = expanded === e.id
              const color = avatarColor(e.name)
              const bal   = MOCK_REPORT_ROWS.find(r => r.name === e.name)

              return (
                <div key={e.id}>
                  <div
                    className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${
                      isExpanded ? 'bg-[#f8fcfd]' : 'hover:bg-[#fafefe]'
                    } ${e.status === 'inactive' ? 'opacity-60' : ''}`}
                    onClick={() => toggleExpand(e.id)}>

                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                      style={{ background: color }}>
                      {initials(e.name)}
                    </div>

                    {/* Name + title */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] text-[#0b2b35] leading-tight">{e.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{e.title}</p>
                    </div>

                    {/* Dept */}
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full hidden md:inline-block flex-shrink-0 ${DEPT_STYLE[e.dept] || 'bg-gray-100 text-gray-500'}`}>
                      {e.dept}
                    </span>

                    {/* Type */}
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${TYPE_STYLE[e.type]}`}>
                      {e.type}
                    </span>

                    {/* Hire date + tenure */}
                    <div className="text-right hidden lg:block flex-shrink-0 w-28">
                      <p className="text-[12px] font-medium text-[#0b2b35]">{fmtHireDate(e.hire_date)}</p>
                      <p className="text-[11px] text-gray-400">{tenure(e.hire_date)}</p>
                    </div>

                    {/* Accrual */}
                    <div className="text-right flex-shrink-0 w-20 hidden lg:block">
                      <p className="text-[13px] font-bold text-[#02ACC0]">{e.accrual.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400">hrs/pp · {e.tier}</p>
                    </div>

                    {/* PTO balance */}
                    <div className="text-right flex-shrink-0 w-20">
                      {bal ? (
                        <>
                          <p className="text-[13px] font-bold text-[#0b2b35]">{bal.pto_bal}</p>
                          <p className="text-[10px] text-gray-400">PTO hrs</p>
                        </>
                      ) : (
                        <p className="text-[11px] text-gray-300">—</p>
                      )}
                    </div>

                    {/* Status + expand */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${
                        e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {e.status}
                      </span>
                      <span className={`text-gray-300 text-[13px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                    </div>
                  </div>

                  {isExpanded && <EmployeeDetail name={e.name} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
