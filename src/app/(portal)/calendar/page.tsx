'use client'

import { useState } from 'react'
import Link from 'next/link'

// Events keyed by YYYY-MM-DD
const EVENTS: Record<string, { type: string; name: string; short: string; mine?: boolean }[]> = {
  '2026-07-01': [{ type: 'bereavement', name: 'Marcus Webb',  short: 'M. Webb' }],
  '2026-07-02': [{ type: 'bereavement', name: 'Marcus Webb',  short: 'M. Webb' }],
  '2026-07-03': [
    { type: 'bereavement', name: 'Marcus Webb',  short: 'M. Webb' },
    { type: 'pto',         name: 'Alex Torres',  short: 'You',     mine: true },
  ],
  '2026-07-04': [
    { type: 'holiday', name: 'Independence Day', short: '🇺🇸 Holiday' },
    { type: 'pto',     name: 'Alex Torres',      short: 'You',       mine: true },
  ],
  '2026-07-07': [{ type: 'personal', name: 'Carla Wilson',  short: 'C. Wilson' }],
  '2026-07-13': [{ type: 'pto',      name: 'James Thomas',  short: 'J. Thomas' }],
  '2026-07-14': [{ type: 'pto',      name: 'James Thomas',  short: 'J. Thomas' }],
  '2026-07-15': [{ type: 'pto',      name: 'James Thomas',  short: 'J. Thomas' }],
  '2026-06-11': [{ type: 'sick',     name: 'Alex Torres',   short: 'You',       mine: true }],
  '2026-05-26': [{ type: 'pto',      name: 'Alex Torres',   short: 'You',       mine: true }],
  '2026-05-27': [{ type: 'pto',      name: 'Alex Torres',   short: 'You',       mine: true }],
}

const UPCOMING = [
  { date: 'Jul 3–4',  name: 'Alex Torres',  type: 'PTO',         mine: true,  status: 'pending' },
  { date: 'Jul 1–3',  name: 'Marcus Webb',  type: 'Bereavement', mine: false, status: 'approved' },
  { date: 'Jul 4',    name: 'Team',         type: 'Holiday',     mine: false, status: 'holiday' },
  { date: 'Jul 7',    name: 'Carla Wilson', type: 'Personal',    mine: false, status: 'approved' },
  { date: 'Jul 13–15',name: 'James Thomas', type: 'PTO',         mine: false, status: 'approved' },
]

const TYPE_STYLE: Record<string, { cell: string; dot: string; label: string }> = {
  pto:         { cell: 'bg-[#e0f5f8] text-[#028a9e]',    dot: 'bg-[#02ACC0]', label: 'PTO'         },
  sick:        { cell: 'bg-violet-100 text-violet-700',   dot: 'bg-violet-500', label: 'Sick'        },
  personal:    { cell: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400',  label: 'Personal'    },
  bereavement: { cell: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400',  label: 'Bereavement' },
  holiday:     { cell: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-400',   label: 'Holiday'     },
  mine:        { cell: 'bg-[#0b2b35] text-white',         dot: 'bg-[#0b2b35]',  label: 'My Leave'    },
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  holiday:  'bg-rose-100 text-rose-700',
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function CalendarPage() {
  // Default to July 2026 where upcoming events live
  const [year,  setYear]  = useState(2026)
  const [month, setMonth] = useState(6) // 0-indexed → July

  const TODAY = '2026-06-30'

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDow  = new Date(year, month, 1).getDay()   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays  = new Date(year, month, 0).getDate()

  const cells: { iso: string; day: number; thisMonth: boolean }[] = []

  // Leading overflow from previous month
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevDays - i
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    cells.push({ iso: isoDate(py, pm, d), day: d, thisMonth: false })
  }
  // This month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: isoDate(year, month, d), day: d, thisMonth: true })
  }
  // Trailing overflow
  let trail = 1
  while (cells.length % 7 !== 0) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    cells.push({ iso: isoDate(ny, nm, trail++), day: trail - 1, thisMonth: false })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Team Leave Calendar</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">See who&apos;s out before submitting requests</p>
        </div>
        <Link href="/request"
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Request Leave
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4eef2]">
            <button onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f7f8] text-gray-400 hover:text-[#0b2b35] transition-colors text-[18px]">
              ‹
            </button>
            <h2 className="text-[15px] font-bold text-[#0b2b35]">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f7f8] text-gray-400 hover:text-[#0b2b35] transition-colors text-[18px]">
              ›
            </button>
          </div>

          <div className="p-4">
            {/* Day of week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DOW.map(d => (
                <div key={d} className="text-center text-[10px] uppercase tracking-widest text-gray-400 py-1.5 font-semibold">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                const events   = EVENTS[cell.iso] || []
                const isToday  = cell.iso === TODAY
                const hasEvents = events.length > 0
                const hasMine  = events.some(e => e.mine)

                return (
                  <div key={i}
                    className={`rounded-lg min-h-[68px] p-1.5 border text-[12px] transition-colors ${
                      !cell.thisMonth ? 'opacity-25 border-transparent' :
                      isToday        ? 'border-[#02ACC0] bg-[#f0fbfc]' :
                      hasMine        ? 'border-[#0b2b35]/20 bg-[#0b2b35]/5' :
                      hasEvents      ? 'border-[#d4eef2] bg-[#fafefe]' :
                                       'border-[#e8f4f7] hover:border-[#d4eef2]'
                    }`}>
                    <div className={`text-[11px] font-bold mb-1 ${
                      isToday ? 'text-[#02ACC0]' : hasMine ? 'text-[#0b2b35]' : 'text-gray-500'
                    }`}>
                      {isToday ? (
                        <span className="inline-flex w-5 h-5 rounded-full bg-[#02ACC0] text-white items-center justify-center text-[10px]">
                          {cell.day}
                        </span>
                      ) : cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {events.slice(0, 2).map((ev, j) => {
                        const s = ev.mine ? TYPE_STYLE.mine : TYPE_STYLE[ev.type] || TYPE_STYLE.pto
                        return (
                          <div key={j} className={`text-[9px] px-1 py-0.5 rounded font-semibold truncate ${s.cell}`}>
                            {ev.short}
                          </div>
                        )
                      })}
                      {events.length > 2 && (
                        <div className="text-[9px] text-gray-400 px-1">+{events.length - 2} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#f0f7f8]">
              {Object.entries(TYPE_STYLE).map(([key, s]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${s.dot}`} />
                  <span className="text-[11px] text-gray-400">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming leave sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#d4eef2]">
              <h3 className="text-[13px] font-bold text-[#0b2b35]">Upcoming Leave</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Next 30 days</p>
            </div>
            <div className="divide-y divide-[#f0f7f8]">
              {UPCOMING.map((item, i) => {
                const typeKey = item.type.toLowerCase()
                const ts = TYPE_STYLE[typeKey] || TYPE_STYLE.pto
                return (
                  <div key={i} className={`px-4 py-3 ${item.mine ? 'bg-[#f8fcfd]' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ts.dot}`} />
                        <span className={`text-[11px] font-semibold ${item.mine ? 'text-[#028a9e]' : 'text-[#0b2b35]'}`}>
                          {item.name}
                          {item.mine && <span className="ml-1 text-[9px] bg-[#d4eef2] text-[#028a9e] px-1 py-0.5 rounded">you</span>}
                        </span>
                      </div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLE[item.status]}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 ml-3.5">{item.type} · {item.date}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* My leave summary */}
          <div className="bg-[#0b2b35] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-[#02ACC0] mb-3">My Scheduled Leave</p>
            <div className="space-y-2">
              {[
                { label: 'PTO (Jul 3–4)',    hrs: 16, status: 'Pending' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[12px] text-white">{item.label}</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/10">
              <Link href="/history" className="text-[11px] text-[#02ACC0] font-semibold hover:underline">
                View all my requests →
              </Link>
            </div>
          </div>

          <Link href="/request"
            className="block bg-white rounded-xl border border-[#d4eef2] p-4 hover:border-[#02ACC0] transition-colors text-center">
            <p className="text-[13px] font-semibold text-[#0b2b35]">+ Request Leave</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Check the calendar first, then submit</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
