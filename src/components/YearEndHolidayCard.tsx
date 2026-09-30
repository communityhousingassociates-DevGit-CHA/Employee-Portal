'use client'

import { useState, useTransition } from 'react'
import { todayET } from '@/lib/pay-periods'
import { setYearEndHoliday } from '@/app/actions/profile'
import { yearEndDate, type YearEndChoice } from '@/lib/holidays'
import { fmtDate } from '@/lib/format-date'

const OPTIONS: { key: YearEndChoice; label: string }[] = [
  { key: 'christmas_eve', label: 'Christmas Eve' },
  { key: 'new_years_eve', label: 'New Year’s Eve' },
]

export default function YearEndHolidayCard({ initial }: { initial: YearEndChoice | null }) {
  const [choice, setChoice] = useState<YearEndChoice | null>(initial)
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const year = Number(todayET().slice(0, 4))

  function save() {
    if (!choice) return
    setError('')
    startTransition(async () => {
      try { await setYearEndHoliday(choice); setSaved(choice) } catch (e) { setError(e instanceof Error ? e.message : 'Could not save') }
    })
  }

  return (
    <div id="year-end-holiday" className="bg-white rounded-xl border border-[#d4eef2] p-6 mb-5">
      <h2 className="text-[14px] font-bold text-[#0b2b35] mb-1">Year-end paid holiday</h2>
      <p className="text-[11px] text-gray-400 mb-4">CHA gives each employee either Christmas Eve or New Year&apos;s Eve as a paid holiday — your choice. It appears on your timesheet as a holiday from the next timesheet created after you choose.</p>
      <div className="flex flex-wrap gap-3 mb-4">
        {OPTIONS.map(o => {
          const date = yearEndDate(year, o.key)
          return (
            <label key={o.key} className={`flex items-center gap-2.5 border rounded-lg px-4 py-2.5 cursor-pointer text-[13px] ${choice === o.key ? 'border-[#02ACC0] bg-[#f0fbfc] text-[#0b2b35]' : 'border-[#d4eef2] text-gray-600 hover:bg-[#f8fcfd]'}`}>
              <input type="radio" name="year-end-holiday" checked={choice === o.key} onChange={() => setChoice(o.key)} className="accent-[#02ACC0]" />
              <span className="font-semibold">{o.label}</span>
              {date && <span className="text-[11px] text-gray-400">{fmtDate(date)}</span>}
            </label>
          )
        })}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!choice || choice === saved || isPending} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">{isPending ? 'Saving…' : 'Save choice'}</button>
        {saved && choice === saved && <span className="text-[12px] text-emerald-600">✓ Saved</span>}
        {error && <span className="text-[12px] text-red-500">{error}</span>}
      </div>
    </div>
  )
}
