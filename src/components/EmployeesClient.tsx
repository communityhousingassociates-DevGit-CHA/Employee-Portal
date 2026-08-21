'use client'

import { useState, useMemo } from 'react'
import { formatEmployeeId } from '@/lib/constants/employee-id'

type Employee = {
  id: string
  employee_number: number
  name: string
  email: string
  employee_type: string
  department: string | null
  job_title: string | null
  hire_date: string
  is_active: boolean
  tier: string
  accrual: number
  status: string
  pto_bal: number
  sick_bal: number
  personal_bal: number
}

const AVATAR_COLORS = ['#02ACC0', '#7c3aed', '#0d9488', '#b45309', '#4f46e5', '#be185d', '#059669', '#9333ea']

function avatarColor(name: string) {
  const n = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function tenure(hire_date: string) {
  const start = new Date(hire_date + 'T00:00:00')
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (months >= 24) {
    const yrs = Math.floor(months / 12)
    const mo = months % 12
    return mo > 0 ? `${yrs} yr ${mo} mo` : `${yrs} yr`
  }
  return `${months} mo`
}

function fmtHireDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TYPE_LABEL: Record<string, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', consultant: 'Consultant' }
const TYPE_STYLE: Record<string, string> = { 'full-time': 'bg-emerald-50 text-emerald-700', 'part-time': 'bg-sky-50 text-sky-700', consultant: 'bg-gray-100 text-gray-600' }

function EmployeeDetail({ e }: { e: Employee }) {
  const capPct = Math.min(Math.round((e.pto_bal / 400) * 100), 100)
  const personalDays = Math.floor(e.personal_bal / 8)

  return (
    <div className="bg-[#f8fcfd] border-t border-[#e8f4f7] px-6 py-5">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Leave Balances — Current</p>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">PTO</p>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+{e.accrual}/pp</span>
          </div>
          <p className="text-[24px] font-black text-[#0b2b35] leading-none">{e.pto_bal}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 mb-2">hrs available</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className={`h-full rounded-full ${capPct >= 75 ? 'bg-amber-400' : 'bg-[#02ACC0]'}`} style={{ width: `${capPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-400">{capPct}% of 400 hr cap{capPct >= 75 ? ' — approaching cap' : ''}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Sick Leave</p>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+3.69/pp</span>
          </div>
          <p className="text-[24px] font-black text-[#0b2b35] leading-none">{e.sick_bal}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 mb-2">hrs available</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min((e.sick_bal / 50) * 100, 100)}%` }} />
          </div>
          <p className="text-[10px] text-gray-400">No annual cap</p>
        </div>

        <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Personal Days</p>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Resets Jan 1</span>
          </div>
          <p className="text-[24px] font-black text-[#0b2b35] leading-none">{personalDays}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 mb-2">days remaining ({e.personal_bal} hrs)</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min((e.personal_bal / 24) * 100, 100)}%` }} />
          </div>
          <p className="text-[10px] text-gray-400">{e.personal_bal} / 24 hrs</p>
        </div>
      </div>
    </div>
  )
}

export default function EmployeesClient({ employees }: { employees: Employee[] }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [showInactive, setShowInactive] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const active = employees.filter(e => e.status === 'active')
  const fullTime = active.filter(e => e.employee_type === 'full-time').length
  const partTime = active.filter(e => e.employee_type === 'part-time').length
  const consult = active.filter(e => e.employee_type === 'consultant').length
  const inactiveCount = employees.filter(e => e.status === 'archived').length

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (!showInactive && e.status === 'archived') return false
      if (typeFilter !== 'All' && TYPE_LABEL[e.employee_type] !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return e.name.toLowerCase().includes(q) || (e.job_title || '').toLowerCase().includes(q) || (e.department || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [employees, search, typeFilter, showInactive])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Employees</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Community Housing Associates staff roster</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active', value: active.length, color: 'text-[#0b2b35]' },
          { label: 'Full-time', value: fullTime, color: 'text-emerald-600' },
          { label: 'Part-time', value: partTime, color: 'text-sky-600' },
          { label: 'Consultants', value: consult, color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-[28px] font-black leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px]">🔍</span>
          <input type="text" placeholder="Search by name, title, or department…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-[#d4eef2] rounded-lg text-[13px] text-[#0b2b35] placeholder-gray-400 focus:outline-none focus:border-[#02ACC0] bg-white" />
        </div>
        <div className="flex gap-1 bg-white border border-[#d4eef2] rounded-lg p-1">
          {['All', 'Full-time', 'Part-time', 'Consultant'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${typeFilter === t ? 'bg-[#02ACC0] text-white' : 'text-gray-500 hover:bg-[#f0f7f8]'}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowInactive(v => !v)}
          className={`text-[12px] font-medium px-3 py-2 rounded-lg border transition-colors ${showInactive ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-[#d4eef2] text-gray-400 hover:bg-[#f0f7f8]'}`}>
          {showInactive ? `Hide inactive` : `Show inactive (${inactiveCount})`}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#d4eef2] flex items-center justify-between">
          <p className="text-[12px] text-gray-400">Showing <strong className="text-[#0b2b35]">{filtered.length}</strong> employee{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-[13px]">No employees match your search.</div>
        ) : (
          <div className="divide-y divide-[#f0f7f8]">
            {filtered.map(e => {
              const isExpanded = expanded === e.id
              const color = avatarColor(e.name)
              return (
                <div key={e.id}>
                  <div className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${isExpanded ? 'bg-[#f8fcfd]' : 'hover:bg-[#fafefe]'} ${e.status === 'archived' ? 'opacity-60' : ''}`}
                    onClick={() => setExpanded(prev => prev === e.id ? null : e.id)}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0" style={{ background: color }}>{initials(e.name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] text-[#0b2b35] leading-tight">{e.name} <span className="text-[10px] text-gray-400 font-normal ml-1">{formatEmployeeId(e.employee_number)}</span></p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{e.job_title || '—'}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full hidden md:inline-block flex-shrink-0 bg-gray-100 text-gray-500">{e.department || '—'}</span>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${TYPE_STYLE[e.employee_type]}`}>{TYPE_LABEL[e.employee_type] || e.employee_type}</span>
                    <div className="text-right hidden lg:block flex-shrink-0 w-28">
                      <p className="text-[12px] font-medium text-[#0b2b35]">{fmtHireDate(e.hire_date)}</p>
                      <p className="text-[11px] text-gray-400">{tenure(e.hire_date)}</p>
                    </div>
                    <div className="text-right flex-shrink-0 w-20 hidden lg:block">
                      <p className="text-[13px] font-bold text-[#02ACC0]">{e.accrual.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400">hrs/pp · {e.tier}</p>
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <p className="text-[13px] font-bold text-[#0b2b35]">{e.pto_bal}</p>
                      <p className="text-[10px] text-gray-400">PTO hrs</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{e.status}</span>
                      <span className={`text-gray-300 text-[13px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                    </div>
                  </div>
                  {isExpanded && <EmployeeDetail e={e} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
