'use client'

import { useEffect, useRef, useState } from 'react'
import { tagColor, type RowTag } from '@/lib/timesheet-tags'
import type { TimesheetTag } from '@/types'

/**
 * A day's tags as pills (automatic + hand-picked). When `editable`, hand-picked pills get an × and a "+ Tag"
 * button opens a picker of the ACTIVE tags from the managed list. Retired tags already on the day stay visible
 * (and removable) but can't be picked again.
 */
export default function TagsCell({
  tags,
  allTags,
  selectedIds,
  editable,
  onChange,
}: {
  tags: RowTag[]
  allTags: TimesheetTag[]
  selectedIds: string[]
  editable: boolean
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const pickable = allTags.filter(t => t.is_active || selectedIds.includes(t.id))

  useEffect(() => {
    if (!open) return
    function close(e: Event) {
      if (e instanceof MouseEvent && (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node))) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function toggleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      // Fixed-position so the popover isn't clipped by the timesheet table's scroll container.
      setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 260), left: Math.min(r.left, window.innerWidth - 240) })
    }
    setOpen(o => !o)
  }

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  return (
    <span className="flex flex-wrap gap-1 items-center">
      {tags.length === 0 && !editable && <span className="text-gray-300">—</span>}
      {tags.map(t => (
        <span key={t.key} title={t.title} className={`text-[10px] font-semibold pl-2 ${t.custom && editable ? 'pr-1' : 'pr-2'} py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1 ${t.cls} ${t.inactive ? 'opacity-60' : ''}`}>
          {t.label}
          {t.custom && editable && t.tagId && (
            <button type="button" aria-label={`Remove ${t.label}`} onClick={() => toggle(t.tagId!)} className="w-3.5 h-3.5 rounded-full hover:bg-black/10 leading-none text-[11px]">×</button>
          )}
        </span>
      ))}
      {editable && allTags.some(t => t.is_active) && (
        <button ref={btnRef} type="button" onClick={toggleOpen} aria-label="Add a tag"
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-dashed border-[#b9dfe6] text-[#028a9e] hover:bg-[#f0f7f8]">
          + Tag
        </button>
      )}

      {open && pos && (
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left }} className="z-50 w-56 max-h-64 overflow-y-auto bg-white rounded-xl border border-[#d4eef2] shadow-xl py-1.5">
          {pickable.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-gray-400">No tags available.</p>
          ) : pickable.map(t => {
            const on = selectedIds.includes(t.id)
            return (
              <button key={t.id} type="button" onClick={() => toggle(t.id)} className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#f8fcfd]">
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] leading-none ${on ? 'bg-[#02ACC0] border-[#02ACC0] text-white' : 'border-gray-300'}`}>{on ? '✓' : ''}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tagColor(t.color).dot}`} />
                <span className={`text-[12px] ${t.is_active ? 'text-[#0b2b35]' : 'text-gray-400'}`}>{t.name}{!t.is_active && ' (retired)'}</span>
              </button>
            )
          })}
        </div>
      )}
    </span>
  )
}
