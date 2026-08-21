'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { getLeaveEventsInRange } from '@/app/actions/calendar'
import { buildCalendarGrid, calendarGridRange } from '@/lib/calendar-grid'
import { holidayOn } from '@/lib/holidays'

type LeaveEvent = {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  status: string
  employee_name: string
  mine: boolean
}

type UpcomingEvent = Omit<LeaveEvent, 'employee_id'>

const TYPE_STYLE: Record<string, { cell: string; dot: string; label: string }> = {
  pto: { cell: 'bg-[#e0f5f8] text-[#028a9e]', dot: 'bg-[#02ACC0]', label: 'PTO' },
  sick: { cell: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', label: 'Sick' },
  personal: { cell: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400', label: 'Personal' },
  bereavement: { cell: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', label: 'Bereavement' },
  'jury duty': { cell: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400', label: 'Jury Duty' },
  holiday: { cell: 'bg-rose-100 text-rose-700', dot: 'bg-rose-400', label: 'Holiday' },
  mine: { cell: 'bg-[#0b2b35] text-white', dot: 'bg-[#0b2b35]', label: 'My Leave' },
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  holiday: 'bg-rose-100 text-rose-700',
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function short(name: string, mine: boolean) {
  if (mine) return 'You'
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : name
}

function fmtRange(start: string, end: string) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return start === end ? fmt(s) : `${fmt(s)}–${e.getDate()}`
}

function eventsForDay(events: LeaveEvent[], iso: string) {
  return events.filter(e => e.start_date <= iso && e.end_date >= iso)
}

export default function CalendarClient({
  initialYear,
  initialMonth,
  initialEvents,
  upcoming,
}: {
  initialYear: number
  initialMonth: number
  initialEvents: LeaveEvent[]
  upcoming: UpcomingEvent[]
}) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [events, setEvents] = useState<LeaveEvent[]>(initialEvents)
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month])

  async function goTo(newYear: number, newMonth: number) {
    setYear(newYear)
    setMonth(newMonth)
    setLoading(true)
    try {
      const range = calendarGridRange(newYear, newMonth)
      const evts = await getLeaveEventsInRange(range.start, range.end)
      setEvents(evts)
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() {
    if (month === 0) goTo(year - 1, 11)
    else goTo(year, month - 1)
  }
  function nextMonth() {
    if (month === 11) goTo(year + 1, 0)
    else goTo(year, month + 1)
  }

  const myUpcoming = upcoming.filter(e => e.mine)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Team Leave Calendar</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">See who&apos;s out before submitting requests</p>
        </div>
        <Link href="/request" className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">+ Request Leave</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
        <div className={`bg-white rounded-xl border border-[#d4eef2] overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4eef2]">
            <button onClick={prevMonth} disabled={loading} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f7f8] text-gray-400 hover:text-[#0b2b35] transition-colors text-[18px]">‹</button>
            <h2 className="text-[15px] font-bold text-[#0b2b35]">{MONTH_NAMES[month]} {year}</h2>
            <button onClick={nextMonth} disabled={loading} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f7f8] text-gray-400 hover:text-[#0b2b35] transition-colors text-[18px]">›</button>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-7 mb-1">
              {DOW.map(d => <div key={d} className="text-center text-[10px] uppercase tracking-widest text-gray-400 py-1.5 font-semibold">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                const dayEvents = eventsForDay(events, cell.iso)
                const holiday = holidayOn(cell.iso)
                const isToday = cell.iso === today
                const hasEvents = dayEvents.length > 0 || !!holiday
                const hasMine = dayEvents.some(e => e.mine)

                return (
                  <div key={i} className={`rounded-lg min-h-[68px] p-1.5 border text-[12px] transition-colors ${
                    !cell.thisMonth ? 'opacity-25 border-transparent' :
                    isToday ? 'border-[#02ACC0] bg-[#f0fbfc]' :
                    hasMine ? 'border-[#0b2b35]/20 bg-[#0b2b35]/5' :
                    hasEvents ? 'border-[#d4eef2] bg-[#fafefe]' :
                    'border-[#e8f4f7] hover:border-[#d4eef2]'
                  }`}>
                    <div className={`text-[11px] font-bold mb-1 ${isToday ? 'text-[#02ACC0]' : hasMine ? 'text-[#0b2b35]' : 'text-gray-500'}`}>
                      {isToday ? <span className="inline-flex w-5 h-5 rounded-full bg-[#02ACC0] text-white items-center justify-center text-[10px]">{cell.day}</span> : cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {holiday && <div className={`text-[9px] px-1 py-0.5 rounded font-semibold truncate ${TYPE_STYLE.holiday.cell}`}>🇺🇸 {holiday}</div>}
                      {dayEvents.slice(0, 2).map(ev => {
                        const s = ev.mine ? TYPE_STYLE.mine : TYPE_STYLE[ev.leave_type.toLowerCase()] || TYPE_STYLE.pto
                        return <div key={ev.id} className={`text-[9px] px-1 py-0.5 rounded font-semibold truncate ${s.cell}`}>{short(ev.employee_name, ev.mine)}</div>
                      })}
                      {dayEvents.length > 2 && <div className="text-[9px] text-gray-400 px-1">+{dayEvents.length - 2} more</div>}
                    </div>
                  </div>
                )
              })}
            </div>

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

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#d4eef2]">
              <h3 className="text-[13px] font-bold text-[#0b2b35]">Upcoming Leave</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Approved &amp; pending</p>
            </div>
            <div className="divide-y divide-[#f0f7f8]">
              {upcoming.length === 0 && <p className="px-4 py-4 text-[12px] text-gray-400">Nothing scheduled.</p>}
              {upcoming.map(item => {
                const ts = TYPE_STYLE[item.leave_type.toLowerCase()] || TYPE_STYLE.pto
                return (
                  <div key={item.id} className={`px-4 py-3 ${item.mine ? 'bg-[#f8fcfd]' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ts.dot}`} />
                        <span className={`text-[11px] font-semibold ${item.mine ? 'text-[#028a9e]' : 'text-[#0b2b35]'}`}>
                          {item.employee_name}
                          {item.mine && <span className="ml-1 text-[9px] bg-[#d4eef2] text-[#028a9e] px-1 py-0.5 rounded">you</span>}
                        </span>
                      </div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLE[item.status]}`}>{item.status}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 ml-3.5">{item.leave_type} · {fmtRange(item.start_date, item.end_date)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-[#0b2b35] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-[#02ACC0] mb-3">My Scheduled Leave</p>
            {myUpcoming.length === 0 ? (
              <p className="text-[12px] text-gray-400">Nothing scheduled.</p>
            ) : (
              <div className="space-y-2">
                {myUpcoming.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-[12px] text-white">{item.leave_type} ({fmtRange(item.start_date, item.end_date)})</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${item.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-white/10">
              <Link href="/history" className="text-[11px] text-[#02ACC0] font-semibold hover:underline">View all my requests →</Link>
            </div>
          </div>

          <Link href="/request" className="block bg-white rounded-xl border border-[#d4eef2] p-4 hover:border-[#02ACC0] transition-colors text-center">
            <p className="text-[13px] font-semibold text-[#0b2b35]">+ Request Leave</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Check the calendar first, then submit</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
