'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function ResponsiveShell({
  topbarLeft,
  topbarRight,
  sidebar,
  children,
}: {
  topbarLeft: React.ReactNode
  topbarRight: React.ReactNode
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => setOpen(false), [pathname])

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="bg-[#0b2b35] text-white flex items-center px-4 sm:px-6 h-14 flex-shrink-0 z-20 print:hidden">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
          className="md:hidden mr-3 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 text-[18px]">
          {open ? '✕' : '☰'}
        </button>
        {topbarLeft}
        <div className="ml-auto flex items-center min-w-0">{topbarRight}</div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        {open && (
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-14 bg-black/40 z-30 md:hidden"
          />
        )}

        {/* Sidebar — static on desktop, slide-over drawer on mobile */}
        <div
          className={`fixed md:static top-14 md:top-auto bottom-0 md:bottom-auto left-0 z-40 flex shadow-xl md:shadow-none transition-transform duration-200 md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}>
          {sidebar}
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
