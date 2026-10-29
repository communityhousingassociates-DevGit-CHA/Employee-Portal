'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { getLeaveEventsInRange } from '@/app/actions/calendar'
import { buildCalendarGrid, calendarGridRange } from '@/lib/calendar-grid'
import { holidayOn } from '@/lib/holidays'
import { payDatesInRange, todayET } from '@/lib/pay-periods'
import { fmtDaySet, fmtDateRange } from '@/lib/format-date'

type Person = { id: string; name: string }
type View = 'month' | 'week' | 'agenda'

type LeaveEvent = {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  /** The days actually taken off (a request can skip days inside its span). */
  dates: string[]
  status: string
  employee_name: string
  mine: boolean
}

type UpcomingEvent = Omit<LeaveEvent, 'employee_id'>

const TYPE_STYLE: Record<string, { cell: string; dot: string; label: string }> = {
  pto: { cell: 'bg-[#e0f5f8] text-[#028a9e]', dot: 'bg-[#02ACC0]', label: 'PTO' },
  sick: { cell: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', label: 'Sick' },
  personal: { cell: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400', label: 'Personal Day' },
  bereavement: { cell: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', label: 'Bereavement' },
  'jury duty': { cell: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400', label: 'Jury Duty' },
  voting: { cell: 'bg-sky-100 text-sky-700', dot: 'bg-sky-400', label: 'Voting' },
  'workers comp': { cell: 'bg-rose-100 text-rose-700', dot: 'bg-rose-400', label: 'Workers’ Comp' },
  military: { cell: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Military' },
  unpaid: { cell: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: 'Unpaid' },
  'flex time': { cell: 'bg-teal-100 text-teal-700', dot: 'bg-teal-400', label: 'Flex Time' },
  holiday: { cell: 'bg-rose-100 text-rose-700', dot: 'bg-rose-400', label: 'Holiday' },
  payday: { cell: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Pay date' },
  mine: { cell: 'bg-[#0b2b35] text-white', dot: 'bg-[#0b2b35]', label: 'My Leave' },
}

// Legend shows the everyday types; the rarer leave types sit under an expandable "Other".
const LEGEND_MAIN = ['pto', 'sick', 'personal', 'holiday', 'payday', 'mine']
const LEGEND_OTHER = ['bereavement', 'jury duty', 'voting', 'workers comp', 'military', 'unpaid', 'flex time']

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  holiday: 'bg-rose-100 text-rose-700',
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const styleFor = (type: string) => TYPE_STYLE[type.toLowerCase()] || TYPE_STYLE.pto
const isMainType = (type: string) => ['pto', 'sick', 'personal'].includes(type.toLowerCase())
const FIRST = (name: string) => name.split(' ')[0]
const INITIALS = (name: string) => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const weekStartOf = (iso: string) => addDays(iso, -new Date(`${iso}T00:00:00Z`).getUTCDay())
const PENDING_STRIPE = { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,.6) 4px 8px)' }

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function short(name: string, mine: boolean) {
  if (mine) return 'You'
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : name
}

function fmtRange(dates: string[]) {
  return fmtDaySet(dates, true)
}

export default function CalendarClient({
  initialYear,
  initialMonth,
  initialEvents,
  upcoming,
  roster,
}: {
  initialYear: number
  initialMonth: number
  initialEvents: LeaveEvent[]
  upcoming: UpcomingEvent[]
  roster: Person[]
}) {
  const today = todayET()
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(today) // the week / agenda start
  const [selected, setSelected] = useState(today)
  const [events, setEvents] = useState<LeaveEvent[]>(initialEvents)
  const [showOther, setShowOther] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  // What the current view needs on screen — month grid, a week, or the next 90 days.
  const range = useMemo(() => {
    if (view === 'month') return calendarGridRange(year, month)
    if (view === 'week') { const s = weekStartOf(anchor); return { start: s, end: addDays(s, 6) } }
    return { start: anchor, end: addDays(anchor, 90) }
  }, [view, year, month, anchor])

  // Loading is derived: the events on screen belong to `loadedKey`, so any other range is still being fetched.
  const rangeKey = `${range.start}|${range.end}`
  const [loadedKey, setLoadedKey] = useState(() => { const r = calendarGridRange(initialYear, initialMonth); return `${r.start}|${r.end}` })
  const loading = loadedKey !== rangeKey

  useEffect(() => {
    if (loadedKey === rangeKey) return
    let cancelled = false
    getLeaveEventsInRange(range.start, range.end)
      .then(evts => { if (!cancelled) { setEvents(evts); setLoadedKey(rangeKey) } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey])

  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month])
  // Paydays are computed from CHA's fixed bi-weekly schedule, so they need no fetch — they appear for any month browsed.
  const payDates = useMemo(() => new Map(payDatesInRange(range.start, range.end).map(p => [p.date, p])), [range])
  const nextPayDates = useMemo(() => {
    const t = todayET()
    const later = new Date(`${t}T00:00:00Z`)
    later.setUTCDate(later.getUTCDate() + 45)
    return payDatesInRange(t, later.toISOString().slice(0, 10)).slice(0, 3)
  }, [])

  const q = query.trim().toLowerCase()
  // Filters only change what is drawn; coverage counts always use everyone who is really out.
  const shown = (e: LeaveEvent) => !hidden.has(isMainType(e.leave_type) ? e.leave_type.toLowerCase() : 'other') && (!q || e.employee_name.toLowerCase().includes(q))
  const outOn = (iso: string) => events.filter(e => e.dates.includes(iso))
  const peopleOut = (iso: string) => new Set(outOn(iso).map(e => e.employee_id)).size

  function toggleFilter(key: string) {
    setHidden(h => { const n = new Set(h); if (n.has(key)) n.delete(key); else n.add(key); return n })
  }

  function step(dir: 1 | -1) {
    if (view === 'month') {
      const m = month + dir
      if (m < 0) { setYear(year - 1); setMonth(11) } else if (m > 11) { setYear(year + 1); setMonth(0) } else setMonth(m)
    } else setAnchor(addDays(anchor, dir * (view === 'week' ? 7 : 30)))
  }
  function goToday() {
    const [y, m] = today.split('-').map(Number)
    setYear(y); setMonth(m - 1); setAnchor(today); setSelected(today)
  }
  function switchView(v: View) {
    if (v !== 'month') setAnchor(v === 'week' ? selected : today)
    setView(v)
  }

  const title = view === 'month' ? `${MONTH_NAMES[month]} ${year}` : view === 'week' ? `Week of ${fmtDaySet([weekStartOf(anchor)], true)}` : 'Upcoming leave'
  const myUpcoming = upcoming.filter(e => e.mine)
  // "Out today" comes from the upcoming list so it stays right while browsing other months.
  const outToday = upcoming.filter(e => e.dates.includes(today))
  const outTodayPeople = [...new Map(outToday.map(e => [e.employee_name, e])).values()]
  const headcount = roster.length

  const selEvents = outOn(selected)
  const selHoliday = holidayOn(selected)
  const selOut = peopleOut(selected)
  const selDow = new Date(`${selected}T00:00:00Z`).getUTCDay()
  const selWeekend = selDow === 0 || selDow === 6

  const filterChips: { key: string; label: string; dot: string }[] = [
    { key: 'pto', label: 'PTO', dot: TYPE_STYLE.pto.dot },
    { key: 'sick', label: 'Sick', dot: TYPE_STYLE.sick.dot },
    { key: 'personal', label: 'Personal Day', dot: TYPE_STYLE.personal.dot },
    { key: 'other', label: 'Other', dot: 'bg-gray-300' },
  ]

  const Avatar = ({ name, mine }: { name: string; mine?: boolean }) => (
    <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ${mine ? 'bg-[#0b2b35]' : 'bg-[#02ACC0]'}`}>{INITIALS(name)}</span>
  )

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Team Leave Calendar</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">See who&apos;s out before submitting requests</p>
        </div>
        <Link href="/request" className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">+ Request/Use Leave</Link>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#028a9e]">Out today</span>
        {outTodayPeople.length === 0 ? (
          <span className="text-[12px] text-gray-400">Everyone is in 🎉</span>
        ) : outTodayPeople.map(e => (
          <span key={e.id} className="inline-flex items-center gap-1.5 bg-[#f0f7f8] rounded-full pl-1 pr-2.5 py-0.5 text-[12px] font-semibold text-[#0b2b35]">
            <Avatar name={e.employee_name} mine={e.mine} />{e.mine ? 'You' : e.employee_name}
            <span className="font-normal text-gray-400">· {e.leave_type}</span>
          </span>
        ))}
        {headcount > 0 && <span className="ml-auto text-[11px] text-gray-400">{Math.max(headcount - outTodayPeople.length, 0)} of {headcount} in</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        <div className={`bg-white rounded-xl border border-[#d4eef2] overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#d4eef2]">
            <button onClick={() => step(-1)} aria-label="Previous" className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#d4eef2] hover:bg-[#f0f7f8] text-gray-500 text-[18px]">‹</button>
            <h2 className="text-[15px] font-bold text-[#0b2b35] min-w-[150px] text-center">{title}</h2>
            <button onClick={() => step(1)} aria-label="Next" className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#d4eef2] hover:bg-[#f0f7f8] text-gray-500 text-[18px]">›</button>
            <button onClick={goToday} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-[#d4eef2] hover:bg-[#f0f7f8] text-[#0b2b35]">Today</button>
            <div className="ml-auto inline-flex rounded-lg border border-[#d4eef2] overflow-hidden">
              {(['month', 'week', 'agenda'] as View[]).map(v => (
                <button key={v} onClick={() => switchView(v)} className={`px-3 py-1.5 text-[12px] font-semibold capitalize ${view === v ? 'bg-[#0b2b35] text-white' : 'bg-white text-gray-500 hover:bg-[#f0f7f8]'}`}>{v}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-[#d4eef2]">
            {filterChips.map(c => (
              <button key={c.key} onClick={() => toggleFilter(c.key)} aria-pressed={!hidden.has(c.key)}
                className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border border-[#d4eef2] text-[#0b2b35] transition-opacity ${hidden.has(c.key) ? 'opacity-40' : ''}`}>
                <span className={`w-2 h-2 rounded-sm ${c.dot}`} />{c.label}
              </button>
            ))}
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a teammate…" aria-label="Find a teammate"
              className="ml-auto w-40 text-[12px] border border-[#d4eef2] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#02ACC0]" />
          </div>

          <div className="p-4">
            {view === 'month' && (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {DOW.map(d => <div key={d} className="text-center text-[10px] uppercase tracking-widest text-gray-400 py-1.5 font-semibold">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map(cell => {
                    const dayEvents = outOn(cell.iso).filter(shown)
                    const holiday = holidayOn(cell.iso)
                    const payDate = payDates.get(cell.iso)
                    const isToday = cell.iso === today
                    const hasMine = dayEvents.some(e => e.mine)
                    const out = peopleOut(cell.iso)
                    return (
                      <button type="button" key={cell.iso} onClick={() => setSelected(cell.iso)} className={`text-left rounded-lg min-h-[84px] p-1.5 border text-[12px] transition-colors hover:border-[#02ACC0] ${
                        !cell.thisMonth ? 'opacity-30 border-transparent' :
                        isToday ? 'border-[#02ACC0] bg-[#f0fbfc]' :
                        hasMine ? 'border-[#0b2b35]/20 bg-[#0b2b35]/5' :
                        'border-[#e8f4f7] bg-white'
                      } ${cell.iso === selected ? 'ring-2 ring-[#0b2b35]' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[11px] font-bold ${isToday ? 'inline-flex w-5 h-5 rounded-full bg-[#02ACC0] text-white items-center justify-center text-[10px]' : hasMine ? 'text-[#0b2b35]' : 'text-gray-500'}`}>{cell.day}</span>
                          {out >= 2 && <span className={`text-[9px] font-bold px-1.5 rounded-full ${out >= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{out} out</span>}
                        </div>
                        <div className="space-y-0.5">
                          {holiday && <div className={`text-[9px] px-1 py-0.5 rounded font-semibold truncate ${TYPE_STYLE.holiday.cell}`}>🇺🇸 {holiday}</div>}
                          {payDate && (
                            <div className={`text-[9px] px-1 py-0.5 rounded font-semibold truncate ${TYPE_STYLE.payday.cell}`}>💵 Pay date{payDate.confirmed ? '' : ' (proj.)'}</div>
                          )}
                          {dayEvents.slice(0, 2).map(ev => {
                            const st = ev.mine ? TYPE_STYLE.mine : styleFor(ev.leave_type)
                            return <div key={ev.id} style={ev.status === 'pending' ? PENDING_STRIPE : undefined} className={`text-[9px] px-1 py-0.5 rounded font-semibold truncate ${st.cell}`}>{short(ev.employee_name, ev.mine)}</div>
                          })}
                          {dayEvents.length > 2 && <div className="text-[9px] text-gray-400 px-1">+{dayEvents.length - 2} more</div>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {view === 'week' && (() => {
              const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(anchor), i))
              const people = roster.filter(p => !q || p.name.toLowerCase().includes(q))
              return (
                <div className="overflow-x-auto">
                  <div className="grid min-w-[640px] border border-[#e8f4f7] rounded-lg overflow-hidden text-[11px]" style={{ gridTemplateColumns: '130px repeat(7, 1fr)' }}>
                    <div className="bg-[#f7fbfc] p-2 font-bold">Team</div>
                    {days.map(d => (
                      <button type="button" key={d} onClick={() => setSelected(d)} className={`p-2 font-bold text-center border-l border-[#eef6f8] ${d === today ? 'bg-[#02ACC0] text-white' : 'bg-[#f7fbfc]'}`}>
                        {fmtDaySet([d], true)}{holidayOn(d) ? ' 🇺🇸' : ''}
                      </button>
                    ))}
                    {people.map(p => (
                      <div key={p.id} className="contents">
                        <div className="p-2 border-t border-[#eef6f8] flex items-center gap-1.5 font-semibold"><Avatar name={p.name} />{FIRST(p.name)}</div>
                        {days.map(d => {
                          const ev = events.find(e => e.employee_id === p.id && e.dates.includes(d) && shown(e))
                          const st = ev ? styleFor(ev.leave_type) : null
                          return (
                            <div key={d} className="border-t border-l border-[#eef6f8] p-1 min-h-[38px]">
                              {ev && st && <div style={ev.status === 'pending' ? PENDING_STRIPE : undefined} className={`h-full rounded-md px-1.5 py-1 text-[10px] font-bold truncate ${st.cell} ${ev.status === 'pending' ? 'border border-dashed border-current' : ''}`}>{st.label}</div>}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {view === 'agenda' && (() => {
              const list = events.filter(e => e.end_date >= anchor && shown(e)).sort((a, b) => a.start_date.localeCompare(b.start_date))
              if (list.length === 0) return <p className="text-[12px] text-gray-400 py-4">Nothing scheduled.</p>
              return list.map(e => (
                <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-[#f0f7f8] last:border-0">
                  <div className="w-12 text-center font-bold text-[#0b2b35] leading-tight">{e.start_date.slice(8)}<span className="block text-[10px] uppercase text-gray-400 font-semibold">{MONTH_NAMES[Number(e.start_date.slice(5, 7)) - 1].slice(0, 3)}</span></div>
                  <Avatar name={e.employee_name} mine={e.mine} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0b2b35] truncate">{e.mine ? 'You' : e.employee_name}</p>
                    <p className="text-[11px] text-gray-400">{e.leave_type} · {fmtRange(e.dates)}</p>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                </div>
              ))
            })()}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4 pt-4 border-t border-[#f0f7f8]">
              {LEGEND_MAIN.map(key => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${TYPE_STYLE[key].dot}`} />
                  <span className="text-[11px] text-gray-400">{TYPE_STYLE[key].label}</span>
                </div>
              ))}
              <button type="button" onClick={() => setShowOther(o => !o)} aria-expanded={showOther}
                className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-[#0b2b35] transition-colors">
                <div className="w-2.5 h-2.5 rounded-sm bg-gray-300" />
                Other <span className="text-[9px]">{showOther ? '▲' : '▼'}</span>
              </button>
              {showOther && (
                <div className="basis-full flex flex-wrap gap-x-3 gap-y-2 pl-1">
                  {LEGEND_OTHER.map(key => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-sm ${TYPE_STYLE[key].dot}`} />
                      <span className="text-[11px] text-gray-400">{TYPE_STYLE[key].label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">Striped = pending approval. Amber badge = 2 out, red = 3 or more out. Click a day for details.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#0b2b35] rounded-xl p-4 text-white">
            <h3 className="text-[13px] font-bold mb-2">{fmtDaySet([selected], true)}</h3>
            {selHoliday && <p className="text-[12px] py-1.5 border-t border-white/10">🇺🇸 {selHoliday} <span className="text-white/50">· Office closed</span></p>}
            {selEvents.length === 0 && !selHoliday && <p className="text-[12px] text-white/50 py-1.5 border-t border-white/10">No one is out.</p>}
            {selEvents.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 py-1.5 border-t border-white/10 text-[12px]">
                <span className="inline-flex items-center gap-2 min-w-0"><Avatar name={e.employee_name} mine={e.mine} /><span className="truncate">{e.mine ? 'You' : e.employee_name}</span></span>
                <span className="text-white/50 flex-shrink-0">{e.leave_type}{e.status === 'pending' ? ' · pending' : ''}</span>
              </div>
            ))}
            {selOut >= 3 && <p className="text-[12px] text-red-300 py-1.5 border-t border-white/10">⚠ {selOut} people out — check coverage before requesting.</p>}
            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/10">
              <span className="text-[11px] text-white/50">{headcount > 0 ? `${Math.max(headcount - selOut, 0)} of ${headcount} available` : ''}</span>
              {!selWeekend && !selHoliday && <Link href={`/request?date=${selected}`} className="bg-[#02ACC0] text-white text-[11px] font-semibold px-2.5 py-1 rounded-md hover:bg-[#028a9e]">Request this day</Link>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#d4eef2]">
              <h3 className="text-[13px] font-bold text-[#0b2b35]">Upcoming Pay Dates</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Direct deposit</p>
            </div>
            <div className="divide-y divide-[#f0f7f8]">
              {nextPayDates.map(p => (
                <div key={p.date} className="px-4 py-3">
                  <p className="text-[12px] font-semibold text-emerald-700">💵 {fmtDaySet([p.date], true)}{p.confirmed ? '' : ' (projected)'}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Pay period {fmtDateRange(p.period.start, p.period.end)}</p>
                  <p className="text-[11px] text-gray-400">Timesheet due {fmtDaySet([p.timesheetDue], true)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#d4eef2]">
              <h3 className="text-[13px] font-bold text-[#0b2b35]">Upcoming Leave</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Approved &amp; pending</p>
            </div>
            <div className="divide-y divide-[#f0f7f8]">
              {upcoming.length === 0 && <p className="px-4 py-4 text-[12px] text-gray-400">Nothing scheduled.</p>}
              {upcoming.slice(0, 10).map(item => {
                const ts = styleFor(item.leave_type)
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
                    <p className="text-[11px] text-gray-400 ml-3.5">{item.leave_type} · {fmtRange(item.dates)}</p>
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
                    <span className="text-[12px] text-white">{item.leave_type} ({fmtRange(item.dates)})</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${item.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-white/10">
              <Link href="/history" className="text-[11px] text-[#02ACC0] font-semibold hover:underline">View all my requests →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
