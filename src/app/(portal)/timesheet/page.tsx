'use client'

import { useState } from 'react'

const days = [
  { date: 'Mon Jun 15', reg: 8, leave: 0, leaveType: '' },
  { date: 'Tue Jun 16', reg: 8, leave: 0, leaveType: '' },
  { date: 'Wed Jun 17', reg: 8, leave: 0, leaveType: 'Admin / Reporting' },
  { date: 'Thu Jun 18', reg: 8, leave: 0, leaveType: '' },
  { date: 'Fri Jun 19', reg: 8, leave: 0, leaveType: '' },
  { date: 'Mon Jun 22', reg: 0, leave: 8, leaveType: 'Sick leave' },
  { date: 'Tue Jun 23', reg: 8, leave: 0, leaveType: '' },
  { date: 'Wed Jun 24', reg: 8, leave: 0, leaveType: 'Community outreach' },
  { date: 'Thu Jun 25', reg: 8, leave: 0, leaveType: 'Admin / Reporting' },
  { date: 'Fri Jun 26', reg: 0, leave: 0, leaveType: '' },
]

export default function TimesheetPage() {
  const [rows, setRows] = useState(days.map(d => ({ ...d })))
  const [signed, setSigned] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const totalReg = rows.reduce((s, r) => s + r.reg, 0)
  const totalLeave = rows.reduce((s, r) => s + r.leave, 0)
  const total = totalReg + totalLeave

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[#0b2b35] mb-2">Timesheet Submitted</h2>
          <p className="text-gray-500 text-sm">Sent to Nico Sanders for approval.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Timesheet</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Pay period: Jun 15 – Jun 28, 2026 · Due Jun 30</p>
        </div>
        <div className="flex gap-2">
          <button className="border border-[#d4eef2] text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors">
            Save Draft
          </button>
          <button
            disabled={!signed}
            onClick={() => setSubmitted(true)}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Submit &amp; Sign
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        {/* Header */}
        <div className="grid grid-cols-[140px_1fr_90px_90px_70px] gap-4 px-5 py-2.5 bg-[#f9fefe] border-b border-[#d4eef2] text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
          <span>Day</span><span>Description / Project</span><span className="text-center">Regular</span><span className="text-center">Leave</span><span className="text-right">Total</span>
        </div>
        {rows.map((row, i) => (
          <div key={i}
            className={`grid grid-cols-[140px_1fr_90px_90px_70px] gap-4 px-5 py-2.5 border-b border-[#f0f7f8] items-center text-[13px]
              ${row.leave > 0 ? 'bg-amber-50' : ''}`}>
            <span className="text-gray-600">{row.date}</span>
            <input
              defaultValue={row.leaveType}
              placeholder="Description..."
              className="px-2 py-1 border border-[#d4eef2] rounded text-[13px] focus:outline-none focus:border-[#02ACC0] w-full" />
            <input
              type="number" min="0" step="0.5" value={row.reg}
              onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, reg: Number(e.target.value) } : r))}
              className="px-2 py-1 border border-[#d4eef2] rounded text-[13px] text-center focus:outline-none focus:border-[#02ACC0] w-full" />
            <input
              type="number" min="0" step="0.5" value={row.leave}
              onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, leave: Number(e.target.value) } : r))}
              className="px-2 py-1 border border-[#d4eef2] rounded text-[13px] text-center focus:outline-none focus:border-[#02ACC0] w-full" />
            <span className="text-right font-semibold text-[#0b2b35]">{row.reg + row.leave}</span>
          </div>
        ))}
        {/* Summary */}
        <div className="flex justify-end gap-6 px-5 py-3.5 bg-[#f9fefe] border-t-2 border-[#d4eef2] text-[13px]">
          <span><span className="text-gray-400">Regular: </span><span className="font-bold text-[#0b2b35]">{totalReg} hrs</span></span>
          <span><span className="text-gray-400">Leave: </span><span className="font-bold text-[#0b2b35]">{totalLeave} hrs</span></span>
          <span><span className="text-gray-400">Total: </span><span className="font-bold text-[#0b2b35]">{total} / 80 hrs</span></span>
        </div>
      </div>

      {/* Signature */}
      <div className="border-2 border-dashed border-[#d4eef2] rounded-xl p-6 text-center bg-white max-w-2xl">
        <p className="text-[13px] font-bold text-[#0b2b35] mb-1">Employee Signature &amp; Submission</p>
        <p className="text-[12px] text-gray-400 mb-4">By submitting, you certify this timesheet is accurate. It will be sent to Nico Sanders for approval.</p>
        <div
          onClick={() => setSigned(true)}
          className={`border-b-2 border-[#0b2b35] mx-auto max-w-[260px] h-12 flex items-end justify-center pb-1 cursor-pointer
            font-[cursive] text-xl text-[#0b2b35] ${signed ? 'border-[#02ACC0]' : 'hover:border-[#02ACC0]'}`}>
          {signed ? 'Maria Edwards' : <span className="text-gray-300 text-sm font-sans">Click to sign</span>}
        </div>
        {signed && <p className="text-[11px] text-gray-400 mt-2">Maria Edwards · Jun 29, 2026 · 9:14 AM</p>}
      </div>
    </div>
  )
}
