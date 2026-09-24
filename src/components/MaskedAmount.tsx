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
}: {
  reveal: () => Promise<number | null>
  format: (n: number) => string
  label: string
  className?: string
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

  const shown = value !== undefined
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={shown ? `Hide ${label}` : `Reveal ${label}`}
      title={shown ? 'Click to hide' : 'Click to reveal'}
      className={`font-mono tabular-nums px-2 py-0.5 rounded border border-transparent hover:border-[#d4eef2] hover:bg-[#f0f7f8] transition-colors ${shown ? 'text-[#0b2b35] font-semibold' : 'text-gray-400 tracking-widest'} ${className}`}
    >
      {loading ? '…' : error ? 'Unavailable' : shown ? (value === null ? '—' : format(value)) : '••••••••'}
    </button>
  )
}
