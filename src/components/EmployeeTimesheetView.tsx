'use client'

import { useState } from 'react'
import { getTimesheetForEmployeePeriod } from '@/app/actions/timesheets'
import type { Timesheet, TimesheetRow } from '@/types'
import type { PayPeriod } from '@/lib/pay-periods'

const TARGET_HOURS = 80

function formatPeriodLabel(p: PayPeriod): string {
  return `${new Date(`${p.start}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(`${p.end}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

// Read-only mirror of TimesheetClient's grid — managers drilling into an
// employee's timesheet can look, never edit. No signature/save/submit here.
export default function EmployeeTimesheetView({
  employeeId,
  periods,
  initialTimesheet,
  initialRows,
}: {
  employeeId: string
  periods: PayPeriod[]
  initialTimesheet: Timesheet | null
  initialRows: TimesheetRow[]
}) {
  const [periodIdx, setPeriodIdx] = useState(0)
  const [timesheet, setTimesheet] = useState<Timesheet | null>(initialTimesheet)
  const [rows, setRows] = useState<TimesheetRow[]>(initialRows)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const period = periods[periodIdx]

  async function switchPeriod(newIdx: number) {
    if (newIdx < 0 || newIdx >= periods.length || newIdx === periodIdx) return
    setLoading(true)
    setError('')
    try {
      const p = periods[newIdx]
      const { timesheet: ts, rows: r } = await getTimesheetForEmployeePeriod(employeeId, p.start, p.end)
      setPeriodIdx(newIdx)
      setTimesheet(ts)
      setRows(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load period')
    } finally {
      setLoading(false)
    }
  }

  const totalReg = rows.reduce((s, r) => s + Number(r.regular_hours), 0)
  const totalLeave = rows.reduce((s, r) => s + Number(r.leave_hours), 0)
  const total = totalReg + totalLeave
  const week1 = rows.slice(0, 5)
  const week2 = rows.slice(5, 10)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
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
        </div>
        {timesheet && (
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${timesheet.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : timesheet.status === 'submitted' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
            {timesheet.status}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      {!timesheet ? (
        <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-xl px-5 py-8 text-center text-[13px] text-gray-400">
          No timesheet for this period.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Regular', value: `${totalReg} hrs`, color: 'text-[#0b2b35]' },
              { label: 'Leave', value: `${totalLeave} hrs`, color: 'text-violet-600' },
              { label: 'Total', value: `${total} / ${TARGET_HOURS}`, color: total > TARGET_HOURS ? 'text-red-500' : 'text-[#0b2b35]' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
                <p className={`text-[18px] font-black leading-none ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[480px]">
                <div className="grid grid-cols-[90px_1fr_80px_80px] gap-3 px-4 py-2 bg-[#f9fefe] border-b border-[#d4eef2]">
                  {['Date', 'Description', 'Regular', 'Leave'].map((h, i) => (
                    <span key={h} className={`text-[10px] uppercase tracking-widest text-gray-400 font-semibold ${i >= 2 ? 'text-center' : ''}`}>{h}</span>
                  ))}
                </div>
                {[week1, week2].map((week, wi) => (
                  <div key={wi}>
                    <div className="px-4 py-1.5 bg-[#fafefe] border-b border-[#e8f4f7]">
                      <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week {wi + 1}</span>
                    </div>
                    {week.map(row => {
                      const d = new Date(`${row.work_date}T00:00:00`)
                      return (
                        <div key={row.id} className={`grid grid-cols-[90px_1fr_80px_80px] gap-3 px-4 py-2 border-b border-[#f0f7f8] items-center text-[13px] ${Number(row.leave_hours) > 0 ? 'bg-violet-50/40' : ''}`}>
                          <div>
                            <p className="font-semibold text-[#0b2b35] text-[12px]">{d.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            <p className="text-[10px] text-gray-400">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          </div>
                          <span className="text-gray-500 truncate">{row.description || '—'}</span>
                          <span className="text-center font-medium text-[#0b2b35]">{row.regular_hours}</span>
                          <span className="text-center font-medium text-violet-600">{row.leave_hours}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
