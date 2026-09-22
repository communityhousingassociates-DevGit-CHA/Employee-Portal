'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { dismissTimesheetReminder } from '@/app/actions/timesheets'

export default function TimesheetAlertBell({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(active)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => setVisible(active), [active])

  if (!visible) return null

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
      aria-label="Timesheet due soon"
      className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors mr-1 flex-shrink-0 group"
    >
      <span className="text-[16px] animate-[wiggle_1.6s_ease-in-out_infinite]">⏰</span>
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
      <button
        onClick={dismiss}
        disabled={dismissing}
        aria-label="Dismiss alert"
        title="Dismiss — no need to open the timesheet"
        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#0b2b35] border border-white/40 text-white text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </Link>
  )
}
