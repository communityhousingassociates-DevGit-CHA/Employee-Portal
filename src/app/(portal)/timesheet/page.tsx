'use client'

import { useState } from 'react'
import { MOCK_USER } from '@/lib/mock-data'
import Link from 'next/link'

const PERIODS = [
  { label: 'Jun 15 – Jun 28, 2026', due: 'Jun 30, 2026', target: 80 },
  { label: 'Jun 1 – Jun 14, 2026',  due: 'Jun 16, 2026', target: 80 },
]

const INITIAL_ROWS = [
  // Week 1
  { date: 'Mon', full: 'Jun 15', reg: 8,   leave: 0, desc: '',                    weekend: false },
  { date: 'Tue', full: 'Jun 16', reg: 8,   leave: 0, desc: '',                    weekend: false },
  { date: 'Wed', full: 'Jun 17', reg: 8,   leave: 0, desc: 'Admin / Reporting',   weekend: false },
  { date: 'Thu', full: 'Jun 18', reg: 8,   leave: 0, desc: '',                    weekend: false },
  { date: 'Fri', full: 'Jun 19', reg: 8,   leave: 0, desc: '',                    weekend: false },
  // Week 2
  { date: 'Mon', full: 'Jun 22', reg: 0,   leave: 8, desc: 'Sick leave',          weekend: false },
  { date: 'Tue', full: 'Jun 23', reg: 8,   leave: 0, desc: '',                    weekend: false },
  { date: 'Wed', full: 'Jun 24', reg: 8,   leave: 0, desc: 'Community outreach',  weekend: false },
  { date: 'Thu', full: 'Jun 25', reg: 8,   leave: 0, desc: 'Admin / Reporting',   weekend: false },
  { date: 'Fri', full: 'Jun 26', reg: 0,   leave: 0, desc: '',                    weekend: false },
]

type Row = typeof INITIAL_ROWS[number]

export default function TimesheetPage() {
  const [periodIdx, setPeriodIdx] = useState(0)
  const [rows, setRows]           = useState<Row[]>(INITIAL_ROWS.map(r => ({ ...r })))
  const [signed, setSigned]       = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [savedDraft, setSavedDraft] = useState(false)

  const period  = PERIODS[periodIdx]
  const totalReg   = rows.reduce((s, r) => s + r.reg, 0)
  const totalLeave = rows.reduce((s, r) => s + r.leave, 0)
  const total      = totalReg + totalLeave
  const pct        = Math.min(Math.round((total / period.target) * 100), 100)
  const remaining  = Math.max(period.target - total, 0)
  const over       = total > period.target

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r))
  }

  function saveDraft() {
    setSavedDraft(true)
    setTimeout(() => setSavedDraft(false), 2000)
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✅</div>
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-2">Timesheet Submitted</h2>
          <p className="text-[13px] text-gray-500 mb-1">{period.label}</p>
          <p className="text-[13px] text-gray-500 mb-5">
            Sent to <strong className="text-[#0b2b35]">Nico Sanders</strong> for approval.
            You&apos;ll be notified when it&apos;s reviewed.
          </p>
          <div className="bg-[#f8fcfd] border border-[#d4eef2] rounded-xl p-4 text-left text-[12px] text-gray-500 mb-5">
            <div className="flex justify-between mb-1"><span>Regular hours</span><strong className="text-[#0b2b35]">{totalReg} hrs</strong></div>
            <div className="flex justify-between mb-1"><span>Leave hours</span><strong className="text-[#0b2b35]">{totalLeave} hrs</strong></div>
            <div className="flex justify-between border-t border-[#e8f4f7] pt-1 mt-1"><span>Total logged</span><strong className="text-[#0b2b35]">{total} / {period.target} hrs</strong></div>
          </div>
          <Link href="/dashboard" className="text-[#02ACC0] text-[13px] font-semibold hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  const week1 = rows.slice(0, 5)
  const week2 = rows.slice(5, 10)
  const week1Total = week1.reduce((s, r) => s + r.reg + r.leave, 0)
  const week2Total = week2.reduce((s, r) => s + r.reg + r.leave, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Timesheet</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => setPeriodIdx(i => Math.min(i + 1, PERIODS.length - 1))}
              disabled={periodIdx >= PERIODS.length - 1}
              className="text-gray-400 hover:text-[#0b2b35] disabled:opacity-30 text-[14px] transition-colors">‹</button>
            <span className="text-[13px] text-gray-500 font-medium">{period.label}</span>
            <button onClick={() => setPeriodIdx(i => Math.max(i - 1, 0))}
              disabled={periodIdx === 0}
              className="text-gray-400 hover:text-[#0b2b35] disabled:opacity-30 text-[14px] transition-colors">›</button>
            <span className="text-[11px] text-amber-600 bg-amber-50 font-semibold px-2 py-0.5 rounded-full ml-1">
              Due {period.due}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={saveDraft}
            className="border border-[#d4eef2] text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#f0f7f8] transition-colors">
            {savedDraft ? '✓ Saved' : 'Save Draft'}
          </button>
          <button
            disabled={!signed}
            onClick={() => setSubmitted(true)}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Submit &amp; Sign
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Regular',   value: `${totalReg} hrs`,            color: 'text-[#0b2b35]' },
          { label: 'Leave',     value: `${totalLeave} hrs`,          color: 'text-violet-600' },
          { label: 'Total',     value: `${total} / ${period.target}`, color: over ? 'text-red-500' : 'text-[#0b2b35]' },
          { label: 'Remaining', value: over ? 'Over by ' + (total - period.target) + ' hrs' : `${remaining} hrs`, color: over ? 'text-red-500' : remaining === 0 ? 'text-emerald-600' : 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-[22px] font-black leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-[#d4eef2] px-5 py-4 mb-6 flex items-center gap-4">
        <div className="flex-1 h-2.5 bg-[#f0f7f8] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : pct === 100 ? 'bg-emerald-500' : 'bg-[#02ACC0]'}`}
            style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[13px] font-bold flex-shrink-0 ${over ? 'text-red-500' : pct === 100 ? 'text-emerald-600' : 'text-[#0b2b35]'}`}>
          {pct}% complete
        </span>
      </div>

      {/* Timesheet table */}
      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <div className="min-w-[620px]">
        {/* Column headers */}
        <div className="grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-2.5 bg-[#f9fefe] border-b border-[#d4eef2]">
          {['Date', 'Description / Project', 'Regular', 'Leave', 'Total'].map((h, i) => (
            <span key={h} className={`text-[10px] uppercase tracking-widest text-gray-400 font-semibold ${i >= 2 ? 'text-center' : ''}`}>{h}</span>
          ))}
        </div>

        {/* Week 1 */}
        <div className="px-5 py-2 bg-[#fafefe] border-b border-[#e8f4f7]">
          <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week 1 · Jun 15–19</span>
        </div>
        {week1.map((row, i) => (
          <TimesheetRow key={i} row={row} idx={i} onUpdate={updateRow} />
        ))}
        <div className="grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-2 bg-[#f9fefe] border-b-2 border-[#d4eef2] text-[12px]">
          <span className="text-gray-400 col-span-4 text-right font-semibold">Week 1 subtotal</span>
          <span className="text-center font-bold text-[#0b2b35]">{week1Total} hrs</span>
        </div>

        {/* Week 2 */}
        <div className="px-5 py-2 bg-[#fafefe] border-b border-[#e8f4f7]">
          <span className="text-[10px] uppercase tracking-widest text-[#02ACC0] font-bold">Week 2 · Jun 22–26</span>
        </div>
        {week2.map((row, i) => (
          <TimesheetRow key={i + 5} row={row} idx={i + 5} onUpdate={updateRow} />
        ))}
        <div className="grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-2 bg-[#f9fefe] border-t border-[#d4eef2] text-[12px]">
          <span className="text-gray-400 col-span-4 text-right font-semibold">Week 2 subtotal</span>
          <span className="text-center font-bold text-[#0b2b35]">{week2Total} hrs</span>
        </div>

        {/* Totals footer */}
        <div className="grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-3.5 bg-[#f0f7f8] border-t-2 border-[#d4eef2] text-[13px]">
          <span className="font-bold text-[#0b2b35]">Totals</span>
          <span />
          <span className="text-center font-bold text-[#0b2b35]">{totalReg}</span>
          <span className="text-center font-bold text-violet-600">{totalLeave}</span>
          <span className="text-center font-bold text-[#0b2b35]">{total} / {period.target}</span>
        </div>
        </div>
        </div>
      </div>

      {/* Signature */}
      <div className="bg-white border border-[#d4eef2] rounded-xl p-4 sm:p-6 max-w-2xl">
        <p className="text-[14px] font-bold text-[#0b2b35] mb-0.5">Employee Certification &amp; Signature</p>
        <p className="text-[12px] text-gray-400 mb-5">
          By signing, I certify that the hours above are accurate and complete. This timesheet will be sent to Nico Sanders for approval.
        </p>

        <div
          onClick={() => setSigned(true)}
          className={`rounded-xl border-2 border-dashed px-6 py-4 cursor-pointer transition-colors text-center mb-4 ${
            signed
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f8fcfd]'
          }`}>
          {signed ? (
            <div>
              <p className="font-[cursive] text-[22px] text-[#0b2b35] mb-1">{MOCK_USER.name}</p>
              <p className="text-[11px] text-gray-400">{MOCK_USER.name} · Signed Jun 29, 2026 · 9:14 AM</p>
            </div>
          ) : (
            <p className="text-gray-300 text-[13px]">Click here to sign</p>
          )}
        </div>

        {signed && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <span>✓</span>
            <span>Signature applied — click <strong>Submit &amp; Sign</strong> above to send for approval.</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TimesheetRow({ row, idx, onUpdate }: { row: Row; idx: number; onUpdate: (i: number, patch: Partial<Row>) => void }) {
  const isLeave   = row.leave > 0
  const rowTotal  = row.reg + row.leave
  const isEmpty   = rowTotal === 0

  return (
    <div className={`grid grid-cols-[100px_1fr_100px_100px_70px] gap-3 px-5 py-2.5 border-b border-[#f0f7f8] items-center text-[13px] transition-colors ${
      isLeave ? 'bg-violet-50/40' : isEmpty ? 'bg-amber-50/30' : ''
    }`}>
      <div>
        <p className="font-semibold text-[#0b2b35] text-[12px]">{row.date}</p>
        <p className="text-[10px] text-gray-400">{row.full}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={row.desc}
          onChange={e => onUpdate(idx, { desc: e.target.value })}
          placeholder="Add description…"
          className="flex-1 px-2 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white"
        />
        {isLeave && (
          <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Leave</span>
        )}
        {isEmpty && (
          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Incomplete</span>
        )}
      </div>
      <HoursInput value={row.reg} onChange={v => onUpdate(idx, { reg: v })} />
      <HoursInput value={row.leave} onChange={v => onUpdate(idx, { leave: v })} />
      <div className={`text-center font-bold ${rowTotal === 8 ? 'text-emerald-600' : rowTotal === 0 ? 'text-gray-300' : 'text-amber-600'}`}>
        {rowTotal > 0 ? rowTotal : '—'}
      </div>
    </div>
  )
}

function HoursInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number" min={0} max={24} step={0.5}
      value={value || ''}
      placeholder="0"
      onChange={e => onChange(Math.max(0, Math.min(24, Number(e.target.value))))}
      className="w-full text-center px-2 py-1.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white"
    />
  )
}
