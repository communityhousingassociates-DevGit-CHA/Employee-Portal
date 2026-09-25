'use client'

import { useEffect, useRef, useState } from 'react'

const HIDE_AFTER_MS = 15000

/**
 * A dollar amount shown as a password-style mask until it is clicked. The value is NOT in the page — clicking
 * asks the server for that one figure (which re-checks access), shows it briefly, then masks it again
 * (click again to hide sooner). Used for salary amounts where shoulder-surfing and screen-sharing matter.
 */
export default function MaskedAmount({
  reveal,
  format,
  label,
  className = '',
  shown,
}: {
  reveal: () => Promise<number | null>
  format: (n: number) => string
  label: string
  className?: string
  /** When set, the amount is displayed as-is (a page-level "show all" is on) and clicking does nothing. */
  shown?: number | null
}) {
  const [value, setValue] = useState<number | null | undefined>(undefined) // undefined = hidden
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function hide() {
    if (timer.current) clearTimeout(timer.current)
    setValue(undefined)
  }

  async function onClick() {
    if (value !== undefined) return hide()
    setLoading(true)
    setError(false)
    try {
      const v = await reveal()
      setValue(v)
      timer.current = setTimeout(hide, HIDE_AFTER_MS)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (shown !== undefined) {
    return <span className={`font-mono tabular-nums px-2 py-0.5 text-[#0b2b35] font-semibold ${className}`}>{shown === null ? '—' : format(shown)}</span>
  }

  const isShown = value !== undefined
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={isShown ? `Hide ${label}` : `Reveal ${label}`}
      title={isShown ? 'Click to hide' : 'Click to reveal'}
      className={`font-mono tabular-nums px-2 py-0.5 rounded border border-transparent hover:border-[#d4eef2] hover:bg-[#f0f7f8] transition-colors ${isShown ? 'text-[#0b2b35] font-semibold' : 'text-gray-400 tracking-widest'} ${className}`}
    >
      {loading ? '…' : error ? 'Unavailable' : isShown ? (value === null ? '—' : format(value)) : '••••••••'}
    </button>
  )
}
