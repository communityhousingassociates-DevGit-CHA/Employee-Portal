'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVITY_COOKIE, IDLE_LOGOUT_MS, IDLE_WARNING_MS } from '@/lib/constants/session'

function readActivity(): number {
  const m = document.cookie.match(new RegExp(`(?:^|; )${ACTIVITY_COOKIE}=(\\d+)`))
  return m ? Number(m[1]) : 0
}
function touch() {
  document.cookie = `${ACTIVITY_COOKIE}=${Date.now()}; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

/**
 * Signs the person out after IDLE_LOGOUT_MS with no real activity, in any tab (the activity time lives in a shared cookie, so a busy
 * second tab keeps the session alive). Shows a warning for the last few minutes. The middleware enforces the same limit on the
 * server, which covers a laptop that was asleep or a browser that was closed.
 */
export default function IdleLogout() {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!readActivity()) touch()
    let last = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - last < 20_000) return // throttle: at most one cookie write per 20 seconds
      last = now
      touch()
      setMinutesLeft(null)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    async function check() {
      const idle = Date.now() - (readActivity() || Date.now())
      if (idle >= IDLE_LOGOUT_MS) {
        try { await createClient().auth.signOut({ scope: 'local' }) } catch { /* the middleware will finish the job */ }
        document.cookie = `${ACTIVITY_COOKIE}=; path=/; max-age=0`
        window.location.assign('/login?reason=idle')
      } else if (idle >= IDLE_LOGOUT_MS - IDLE_WARNING_MS) {
        setMinutesLeft(Math.max(1, Math.ceil((IDLE_LOGOUT_MS - idle) / 60_000)))
      } else {
        setMinutesLeft(null)
      }
    }
    const timer = setInterval(check, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [])

  if (minutesLeft === null) return null
  return (
    <div role="alert" className="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-amber-300 shadow-lg rounded-xl px-4 py-3">
      <p className="text-[13px] font-semibold text-[#0b2b35]">Still there?</p>
      <p className="text-[12px] text-gray-600 mt-0.5">For security, you&apos;ll be signed out in about {minutesLeft} minute{minutesLeft === 1 ? '' : 's'} because of inactivity.</p>
      <button onClick={() => { touch(); setMinutesLeft(null) }} className="mt-2 bg-[#02ACC0] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#028a9e]">Stay signed in</button>
    </div>
  )
}
