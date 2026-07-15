'use client'

import { useState, useMemo } from 'react'

const PAY_PERIODS = [
  { label: 'Jun 15 – Jun 28, 2026', value: '2026-06-15' },
  { label: 'Jun 1 – Jun 14, 2026',  value: '2026-06-01' },
  { label: 'May 18 – May 31, 2026', value: '2026-05-18' },
  { label: 'May 4 – May 17, 2026',  value: '2026-05-04' },
  { label: 'Apr 20 – May 3, 2026',  value: '2026-04-20' },
  { label: 'Apr 6 – Apr 19, 2026',  value: '2026-04-06' },
]

export type ReportRow = {
  name: string
  initials: string
  pto_used: number
  sick_used: number
  personal_used: number
  pto_bal: number
  sick_bal: number
  personal_bal: number
  accrual: number
}

export default function ReportsClient({ rows, isManager }: { rows: ReportRow[]; isManager: boolean }) {
  const [period, setPeriod] = useState(PAY_PERIODS[0].value)
  const [typeFilter, setTypeFilter] = useState('All')

  const selectedPeriod = PAY_PERIODS.find(p => p.value === period)!

  const filteredRows = useMemo(() => {
    if (typeFilter === 'PTO')      return rows.filter(r => r.pto_used > 0)
    if (typeFilter === 'Sick')     return rows.filter(r => r.sick_used > 0)
    if (typeFilter === 'Personal') return rows.filter(r => r.personal_used > 0)
    return rows
  }, [rows, typeFilter])

  const totalPto      = filteredRows.reduce((s, r) => s + r.pto_used, 0)
  const totalSick     = filteredRows.reduce((s, r) => s + r.sick_used, 0)
  const totalPersonal = filteredRows.reduce((s, r) => s + r.personal_used, 0)
  const maxUsed       = Math.max(...filteredRows.map(r => r.pto_used + r.sick_used + r.personal_used), 1)
  const rowsWithUsage = filteredRows.filter(r => r.pto_used + r.sick_used + r.personal_used > 0)

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-show { display: block !important; }
          body { background: white !important; }
          table { font-size: 11px !important; }
          th, td { padding: 6px 10px !important; }
        }
        @media screen { .print-show { display: none !important; } }
      `}</style>

      {/* Print-only header */}
      <div className="print-show mb-6 pb-4 border-b border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cha-logo.png" alt="CHA" style={{ height: 28, marginBottom: 8 }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0b2b35', margin: 0 }}>Leave Report — {selectedPeriod.label}</h1>
        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          Community Housing Associates · Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Screen header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 no-print">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Leave Reports</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {isManager ? 'All staff — Community Housing Associates' : 'My leave summary'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const headers = ['Employee', 'PTO Used (hrs)', 'PTO Balance (hrs)', 'PTO Cap %', 'Sick Used (hrs)', 'Sick Balance (hrs)', 'Personal Remaining (hrs)', 'Accrual/Pay Period (hrs)']
              const csvRows = filteredRows.map(r => [
                r.name,
                r.pto_used,
                r.pto_bal,
                `${Math.min(Math.round((r.pto_bal / 400) * 100), 100)}%`,
                r.sick_used,
                r.sick_bal,
                r.personal_bal,
                r.accrual,
              ])
              const csv = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `CHA-Leave-Report-${selectedPeriod.label.replace(/[^a-z0-9]/gi, '-')}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="border border-[#d4eef2] text-[#0b2b35] text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors flex items-center gap-2">
            ⬇ Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors flex items-center gap-2">
            ⬇ Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      {isManager && (
        <div className="flex flex-wrap gap-3 mb-6 no-print">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="border border-[#d4eef2] rounded-lg px-3 py-2 text-[13px] text-[#0b2b35] focus:outline-none focus:border-[#02ACC0] bg-white cursor-pointer">
            {PAY_PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <div className="flex gap-1 bg-white border border-[#d4eef2] rounded-lg p-1">
            {['All', 'PTO', 'Sick', 'Personal'].map(t => (
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
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'PTO Hours Used',      value: `${totalPto} hrs`,      color: '#02ACC0' },
          { label: 'Sick Hours Used',      value: `${totalSick} hrs`,     color: '#7c3aed' },
          { label: 'Personal Hours Used',  value: `${totalPersonal} hrs`, color: '#f59e0b' },
          { label: isManager ? 'Employees Reported' : 'Pay Period',
            value: isManager ? filteredRows.length : selectedPeriod.label.split(',')[0],
            color: '#0b2b35' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className="text-[26px] font-black leading-none mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Visual usage bars — screen only */}
      {isManager && rowsWithUsage.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-6 mb-6 no-print">
          <h2 className="text-[13px] font-bold text-[#0b2b35] mb-4">Hours Used This Period</h2>
          <div className="space-y-2.5">
            {rowsWithUsage.map(r => {
              const total  = r.pto_used + r.sick_used + r.personal_used
              const ptoW   = (r.pto_used      / maxUsed) * 100
              const sickW  = (r.sick_used     / maxUsed) * 100
              const persW  = (r.personal_used / maxUsed) * 100
              return (
                <div key={r.name} className="flex items-center gap-3">
                  <div className="w-[120px] text-[12px] font-medium text-[#0b2b35] flex-shrink-0 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#d4eef2] flex items-center justify-center text-[9px] font-bold text-[#028a9e] flex-shrink-0">
                      {r.initials}
                    </div>
                    <span className="truncate">{r.name.split(' ')[0]}</span>
                  </div>
                  <div className="flex-1 flex gap-0.5 h-7 rounded-lg overflow-hidden bg-[#f8fcfd]">
                    {r.pto_used > 0 && (
                      <div style={{ width: `${ptoW}%`, backgroundColor: '#02ACC0' }}
                        className="flex items-center justify-center text-white text-[10px] font-bold transition-all"
                        title={`PTO: ${r.pto_used}h`}>
                        {r.pto_used}
                      </div>
                    )}
                    {r.sick_used > 0 && (
                      <div style={{ width: `${sickW}%`, backgroundColor: '#7c3aed' }}
                        className="flex items-center justify-center text-white text-[10px] font-bold transition-all"
                        title={`Sick: ${r.sick_used}h`}>
                        {r.sick_used}
                      </div>
                    )}
                    {r.personal_used > 0 && (
                      <div style={{ width: `${persW}%`, backgroundColor: '#f59e0b' }}
                        className="flex items-center justify-center text-white text-[10px] font-bold transition-all"
                        title={`Personal: ${r.personal_used}h`}>
                        {r.personal_used}
                      </div>
                    )}
                  </div>
                  <span className="text-[12px] text-gray-400 w-12 text-right flex-shrink-0">{total} hrs</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-5 mt-4 pt-4 border-t border-[#f0f7f8]">
            {([['#02ACC0', 'PTO'], ['#7c3aed', 'Sick'], ['#f59e0b', 'Personal']] as const).map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#d4eef2] flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-[#0b2b35]">Pay Period: {selectedPeriod.label}</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">All balances in hours · PTO carryover cap: 400 hrs</p>
          </div>
          {typeFilter !== 'All' && (
            <span className="text-[11px] bg-[#e0f5f8] text-[#028a9e] font-semibold px-2.5 py-1 rounded-full no-print">
              {typeFilter} only
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#f9fefe] border-b border-[#d4eef2]">
                {isManager && <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Employee</th>}
                <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">PTO Used</th>
                <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">PTO Balance</th>
                <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Cap</th>
                <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Sick Used</th>
                <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Sick Balance</th>
                <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Personal Rem.</th>
                <th className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 font-semibold no-print">Accrual/PP</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(r => {
                const capPct     = Math.min(Math.round((r.pto_bal / 400) * 100), 100)
                const capWarning = capPct >= 75
                return (
                  <tr key={r.name} className="border-b border-[#f0f7f8] last:border-0 hover:bg-[#fafefe]">
                    {isManager && (
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#d4eef2] flex items-center justify-center text-[9px] font-bold text-[#028a9e] flex-shrink-0">
                            {r.initials}
                          </div>
                          <span className="font-medium text-[#0b2b35] whitespace-nowrap">{r.name}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-3">
                      {r.pto_used
                        ? <span className="font-semibold text-[#02ACC0]">{r.pto_used} hrs</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 font-semibold text-[#0b2b35]">{r.pto_bal} hrs</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <div className="w-16 h-1.5 bg-[#f0f7f8] rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className={`h-full rounded-full ${capWarning ? 'bg-amber-400' : 'bg-[#02ACC0]'}`}
                            style={{ width: `${capPct}%` }} />
                        </div>
                        <span className={`text-[11px] font-semibold whitespace-nowrap ${capWarning ? 'text-amber-500' : 'text-gray-400'}`}>
                          {capPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {r.sick_used
                        ? <span className="font-semibold text-violet-600">{r.sick_used} hrs</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3 font-semibold text-[#0b2b35]">{r.sick_bal} hrs</td>
                    <td className="px-5 py-3">
                      <span className={`font-semibold ${r.personal_bal <= 8 ? 'text-amber-500' : 'text-[#0b2b35]'}`}>
                        {r.personal_bal} hrs
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 no-print">{r.accrual} hrs</td>
                  </tr>
                )
              })}
            </tbody>
            {isManager && filteredRows.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-[#d4eef2] bg-[#f9fefe]">
                  <td className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Totals</td>
                  <td className="px-5 py-3 font-bold text-[#02ACC0]">{totalPto} hrs</td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 font-bold text-violet-600">{totalSick} hrs</td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 font-bold text-amber-500">{totalPersonal} hrs</td>
                  <td className="px-5 py-3 no-print" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}
