import Link from 'next/link'

const calDays = [
  { n: 28, other: true, events: [] },
  { n: 29, other: true, events: [] },
  { n: 30, other: true, events: [] },
  { n: 1, events: [] },
  { n: 2, events: [] },
  { n: 3, events: [{ type: 'pto', label: 'M. Edwards' }] },
  { n: 4, events: [{ type: 'holiday', label: 'Holiday' }, { type: 'pto', label: 'M. Edwards' }] },
  { n: 5, events: [] }, { n: 6, events: [] }, { n: 7, events: [] },
  { n: 8, events: [] }, { n: 9, events: [] }, { n: 10, events: [] }, { n: 11, events: [] },
  { n: 12, events: [] },
  { n: 13, events: [{ type: 'pto', label: 'J. Thomas' }, { type: 'pto', label: 'C. Wilson' }] },
  { n: 14, events: [{ type: 'pto', label: 'J. Thomas' }, { type: 'pto', label: 'C. Wilson' }] },
  { n: 15, events: [{ type: 'pto', label: 'J. Thomas' }] },
  { n: 16, events: [] }, { n: 17, events: [] }, { n: 18, events: [] },
  { n: 19, events: [] }, { n: 20, today: true, events: [] }, { n: 21, events: [] },
  { n: 22, events: [] }, { n: 23, events: [] }, { n: 24, events: [] }, { n: 25, events: [] },
  { n: 26, events: [] }, { n: 27, events: [] }, { n: 28, events: [] },
  { n: 29, events: [] }, { n: 30, events: [] }, { n: 31, events: [] },
  { n: 1, other: true, events: [] },
]

const eventStyle: Record<string, string> = {
  pto: 'bg-[#e0f5f8] text-[#028a9e]',
  sick: 'bg-violet-100 text-violet-700',
  holiday: 'bg-amber-100 text-amber-700',
}

export default function CalendarPage() {
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Team Leave Calendar</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">July 2026 — see who is out before submitting requests</p>
        </div>
        <Link href="/request"
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Request Leave
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[11px] uppercase tracking-wide text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calDays.map((day, i) => (
            <div key={i}
              className={`rounded-lg p-1.5 min-h-[64px] border text-[12px] cursor-pointer hover:border-[#02ACC0] transition-colors
                ${day.today ? 'border-[#02ACC0]' : 'border-[#d4eef2]'}
                ${day.other ? 'opacity-30' : ''}`}>
              <div className={`font-bold mb-1 ${day.today ? 'text-[#02ACC0]' : 'text-[#0b2b35]'}`}>{day.n}</div>
              {day.events.map((ev, j) => (
                <div key={j} className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate ${eventStyle[ev.type]}`}>{ev.label}</div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-[12px] text-gray-400">
          <span><span className="inline-block w-2.5 h-2.5 bg-[#e0f5f8] rounded-sm mr-1.5 align-middle" />PTO</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-violet-100 rounded-sm mr-1.5 align-middle" />Sick</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-amber-100 rounded-sm mr-1.5 align-middle" />Holiday</span>
        </div>
      </div>
    </div>
  )
}
