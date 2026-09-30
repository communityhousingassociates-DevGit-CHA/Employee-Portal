'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { dismissTimesheetReminder } from '@/app/actions/timesheets'
import { fmtDate } from '@/lib/format-date'

type Reminder = { due: string; daysUntil: number } | null

export default function TimesheetAlertBell({ active, reminder = null }: { active: boolean; reminder?: Reminder }) {
  const [visible, setVisible] = useState(active)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => setVisible(active), [active])

  if (!visible) return null

  // "Timesheet due Fri 10-02-2026 · tomorrow" — the cutoff date, not just a nudge.
  const dueLabel = reminder ? `${new Date(`${reminder.due}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })} ${fmtDate(reminder.due)}` : null
  const when = reminder ? (reminder.daysUntil === 0 ? 'today' : reminder.daysUntil === 1 ? 'tomorrow' : `in ${reminder.daysUntil} days`) : null

  async function dismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDismissing(true)
    setVisible(false)
    try {
      await dismissTimesheetReminder()
    } catch {
      // best-effort — worst case it reappears next load
    } finally {
      setDismissing(false)
    }
  }

  return (
    <Link
      href="/timesheet"
      aria-label={dueLabel ? `Timesheet due ${dueLabel}, ${when}` : 'Timesheet due soon'}
      title={dueLabel ? `Timesheet due ${dueLabel} (${when})` : undefined}
      className="relative flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg pl-3 pr-7 py-2 flex-shrink-0 hover:bg-red-100 transition-colors"
    >
      <span className="text-[16px] animate-[wiggle_1.6s_ease-in-out_infinite]">⏰</span>
      <span className="text-[12px] font-semibold text-red-700 hidden sm:inline">{dueLabel ? <>Timesheet due {dueLabel} <span className="font-normal">· {when}</span></> : 'Timesheet due soon'}</span>
      <button
        onClick={dismiss}
        disabled={dismissing}
        aria-label="Dismiss alert"
        title="Dismiss — no need to open the timesheet"
        className="absolute top-1/2 -translate-y-1/2 right-1.5 w-4 h-4 rounded-full bg-red-200 text-red-800 text-[9px] leading-none flex items-center justify-center hover:bg-red-300 transition-colors"
      >
        ×
      </button>
    </Link>
  )
}
