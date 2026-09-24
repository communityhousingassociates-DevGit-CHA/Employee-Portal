'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markNotificationsRead } from '@/app/actions/notifications'
import type { PortalNotification, NotificationKind } from '@/types'

const KIND_STYLE: Record<NotificationKind, { icon: string; cls: string }> = {
  approval_needed: { icon: '📥', cls: 'bg-[#e0f5f8] text-[#028a9e]' },
  approved: { icon: '✓', cls: 'bg-emerald-100 text-emerald-700' },
  denied: { icon: '✕', cls: 'bg-red-100 text-red-700' },
  returned: { icon: '↩', cls: 'bg-amber-100 text-amber-700' },
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export default function NotificationBell({ items, unreadCount }: { items: PortalNotification[]; unreadCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function markAllRead() {
    try { await markNotificationsRead() } catch { /* best-effort */ }
    refresh()
  }

  async function openItem(n: PortalNotification) {
    setOpen(false)
    if (!n.read_at) {
      try { await markNotificationsRead([n.id]) } catch { /* best-effort */ }
    }
    if (n.link) router.push(n.link)
    refresh()
  }

  return (
    <div ref={ref} className="relative mr-1 flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
      >
        <span className="text-[16px]">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] bg-white text-[#0b2b35] rounded-xl border border-[#d4eef2] shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8f4f7]">
            <p className="text-[13px] font-bold">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-semibold text-[#02ACC0] hover:underline">Mark all read</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-gray-400">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-[26rem] overflow-y-auto divide-y divide-[#f0f7f8]">
              {items.map(n => {
                const st = KIND_STYLE[n.kind] ?? KIND_STYLE.approval_needed
                return (
                  <li key={n.id}>
                    <button onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-[#f8fcfd] transition-colors ${n.read_at ? '' : 'bg-[#f5fbfc]'}`}>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${st.cls}`}>{st.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-[13px] leading-snug ${n.read_at ? 'font-medium' : 'font-bold'}`}>{n.title}</span>
                          {!n.read_at && <span className="w-2 h-2 rounded-full bg-[#02ACC0] flex-shrink-0 mt-1.5" aria-label="Unread" />}
                        </span>
                        {n.body && <span className="block text-[12px] text-gray-500 mt-0.5 whitespace-pre-line line-clamp-3">{n.body}</span>}
                        <span className="block text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
