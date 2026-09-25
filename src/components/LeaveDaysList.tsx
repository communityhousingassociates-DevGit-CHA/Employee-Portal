import { fmtDate } from '@/lib/format-date'

type Day = { date: string; hours: number }

function weekday(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
}

/** The days of a multi-day leave request, one row each with its hours — the week's worth of time off at a glance. */
export default function LeaveDaysList({ days, className = '' }: { days: Day[]; className?: string }) {
  if (days.length < 2) return null
  const total = days.reduce((sum, d) => sum + d.hours, 0)
  return (
    <div className={`rounded-lg border border-[#e8f4f7] bg-white overflow-hidden ${className}`}>
      {days.map(d => (
        <div key={d.date} className="flex items-center justify-between px-3 py-1.5 text-[12px] border-b border-[#f0f7f8] last:border-0">
          <span className="text-[#0b2b35]"><span className="inline-block w-9 text-gray-400">{weekday(d.date)}</span>{fmtDate(d.date)}</span>
          <span className="font-semibold text-[#0b2b35]">{d.hours} hrs{d.hours < 8 && <span className="ml-1.5 text-[10px] font-medium text-amber-600">partial</span>}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-3 py-1.5 text-[12px] bg-[#f8fcfd] font-semibold text-[#0b2b35]">
        <span>{days.length} days</span><span>{total} hrs</span>
      </div>
    </div>
  )
}
