'use client'

import { useState } from 'react'
import Link from 'next/link'
import { markIssuesSeen } from '@/app/actions/report-issue'

export default function IssueAlertBell({ initialUnseenCount }: { initialUnseenCount: number }) {
  const [unseenCount, setUnseenCount] = useState(initialUnseenCount)
  const [dismissing, setDismissing] = useState(false)

  if (unseenCount <= 0) return null

  async function dismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDismissing(true)
    setUnseenCount(0)
    try {
      await markIssuesSeen()
    } catch {
      // best-effort — worst case it reappears next load
    } finally {
      setDismissing(false)
    }
  }

  return (
    <Link
      href="/issues"
      aria-label={`${unseenCount} new issue report${unseenCount === 1 ? '' : 's'}`}
      className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors mr-1 flex-shrink-0 group"
    >
      <span className="text-[16px] animate-[wiggle_1.6s_ease-in-out_infinite]">🔔</span>
      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
        {unseenCount}
      </span>
      <button
        onClick={dismiss}
        disabled={dismissing}
        aria-label="Dismiss alert"
        title="Dismiss — mark as seen without opening"
        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#0b2b35] border border-white/40 text-white text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </Link>
  )
}
