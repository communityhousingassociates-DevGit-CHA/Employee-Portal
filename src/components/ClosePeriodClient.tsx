'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { closePeriod, liftClosure, previewClosePeriod, type ClosePreview } from '@/app/actions/close-period'
import { fmtDate, fmtDateRange } from '@/lib/format-date'
import type { PayPeriod } from '@/lib/pay-periods'

type Closure = {
  id: string
  start_date: string
  end_date: string
  note: string | null
  closed_at: string
  closed_by_name: string | null
  lifted_at: string | null
  lifted_by_name: string | null
  lift_note: string | null
}

const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white'

export default function ClosePeriodClient({ history, canLift, today, recentPeriods }: { history: Closure[]; canLift: boolean; today: string; recentPeriods: PayPeriod[] }) {
  const router = useRouter()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<ClosePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [lifting, setLifting] = useState<string | null>(null)
  const [liftNote, setLiftNote] = useState('')

  const active = history.filter(h => !h.lifted_at)
  const past = history.filter(h => h.lifted_at)
  const ready = !!start && !!end && end >= start

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  function usePeriod(idx: string) {
    if (idx === '') return
    const p = recentPeriods[Number(idx)]
    // Only closable through today.
    setStart(p.start)
    setEnd(p.end > today ? today : p.end)
    setPreview(null)
    setError('')
  }

  async function handlePreview() {
    setBusy(true); setError('')
    try { setPreview(await previewClosePeriod(start, end)) } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to check these dates'); setPreview(null) } finally { setBusy(false) }
  }

  async function handleClose() {
    setBusy(true); setError('')
    try {
      await closePeriod(start, end, note)
      showToast(`Closed ${fmtDateRange(start, end)}`)
      setStart(''); setEnd(''); setNote(''); setPreview(null)
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to close') } finally { setBusy(false) }
  }

  async function handleLift(id: string) {
    setBusy(true); setError('')
    try {
      await liftClosure(id, liftNote)
      showToast('Closure lifted')
      setLifting(null); setLiftNote('')
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to lift') } finally { setBusy(false) }
  }

  const unfinished = preview ? preview.drafts.length + preview.submitted.length + preview.pendingLeave.length : 0

  return (
    <div className="max-w-3xl">
      {toast && <div className="fixed top-4 right-4 z-50 bg-[#0b2b35] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-lg">{toast}</div>}

      <h1 className="text-[22px] font-bold text-[#0b2b35]">Close Period</h1>
      <p className="text-[13px] text-gray-500 mt-0.5 mb-6">
        Close out a range of dates once time for them is final. While closed: no new leave can be entered for those dates, timesheets that touch them can&apos;t be edited or submitted, and reopening one needs the CEO override.
      </p>

      <div className="bg-white rounded-xl border border-[#d4eef2] p-5 mb-6">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Choose dates to close</p>

        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Quick fill from a pay period <span className="normal-case font-normal text-gray-400">(optional)</span></label>
          <select defaultValue="" onChange={e => usePeriod(e.target.value)} className={inputCls}>
            <option value="">— Pick a pay period, or choose any dates below —</option>
            {recentPeriods.map((p, i) => <option key={p.start} value={i}>{fmtDateRange(p.start, p.end)}{i === 0 ? ' (current)' : ''}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">From</label>
            <input type="date" value={start} max={today} onChange={e => { setStart(e.target.value); setPreview(null); if (end && e.target.value > end) setEnd('') }} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Through</label>
            <input type="date" value={end} min={start || undefined} max={today} onChange={e => { setEnd(e.target.value); setPreview(null) }} className={inputCls} />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 -mt-2 mb-4">Pick dates from the calendar. You can close dates up to today, at most 92 days at a time.</p>

        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Note <span className="normal-case font-normal text-gray-400">(optional)</span></label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Payroll processed for pay period ending 09-12" className={inputCls} />
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[12px] rounded-lg px-3 py-2 mb-3">{error}</div>}

        {!preview ? (
          <button onClick={handlePreview} disabled={!ready || busy}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? 'Checking…' : 'Review before closing'}
          </button>
        ) : (
          <div className="border border-[#d4eef2] rounded-xl p-4 bg-[#f8fcfd]">
            <p className="text-[13px] font-semibold text-[#0b2b35] mb-2">Closing {fmtDateRange(start, end)}</p>
            {unfinished === 0 ? (
              <p className="text-[12px] text-emerald-700 mb-3">✓ No unfinished timesheets or pending leave in these dates ({preview.approved} approved timesheet{preview.approved === 1 ? '' : 's'}).</p>
            ) : (
              <div className="text-[12px] bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 mb-3 space-y-1.5">
                <p className="font-semibold">Unfinished items — these will be locked as they are:</p>
                {preview.submitted.length > 0 && <p><strong>{preview.submitted.length} submitted, not yet approved:</strong> {preview.submitted.map(s => s.name).join(', ')}</p>}
                {preview.drafts.length > 0 && <p><strong>{preview.drafts.length} not submitted:</strong> {preview.drafts.map(s => s.name).join(', ')}</p>}
                {preview.pendingLeave.length > 0 && <p><strong>{preview.pendingLeave.length} pending leave request{preview.pendingLeave.length > 1 ? 's' : ''}</strong> (can no longer be approved): {preview.pendingLeave.map(l => `${l.name} — ${l.label}`).join('; ')}</p>}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleClose} disabled={busy}
                className="bg-red-500 text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
                {busy ? 'Closing…' : 'Close these dates'}
              </button>
              <button onClick={() => setPreview(null)} className="border border-[#d4eef2] text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-white">Back</button>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-[15px] font-bold text-[#0b2b35] mb-3">Currently closed</h2>
      {active.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-8 text-center text-[13px] text-gray-400 mb-6">Nothing is closed right now.</div>
      ) : (
        <div className="space-y-3 mb-6">
          {active.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-[#d4eef2] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-bold text-[#0b2b35]">{fmtDateRange(c.start_date, c.end_date)}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">Closed {fmtDate(c.closed_at)}{c.closed_by_name ? ` by ${c.closed_by_name}` : ''}</p>
                  {c.note && <p className="text-[12px] text-gray-500 mt-1">{c.note}</p>}
                </div>
                {canLift && lifting !== c.id && (
                  <button onClick={() => { setLifting(c.id); setLiftNote(''); setError('') }} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">Lift closure</button>
                )}
              </div>
              {lifting === c.id && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-[12px] text-amber-800 mb-2">Lifting reopens these dates for leave requests and timesheet edits. A note is required and the closure stays in the history below.</p>
                  <textarea value={liftNote} onChange={e => setLiftNote(e.target.value)} rows={2} placeholder="Why is this closure being lifted?"
                    className="w-full text-[12px] border border-amber-200 rounded-lg px-3 py-2 mb-3 bg-white focus:outline-none focus:border-amber-400 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => handleLift(c.id)} disabled={busy || !liftNote.trim()} className="bg-amber-500 text-white text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50">{busy ? 'Lifting…' : 'Confirm — lift closure'}</button>
                    <button onClick={() => setLifting(null)} className="text-[12px] font-semibold px-4 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-100">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!canLift && active.length > 0 && <p className="text-[11px] text-gray-400 -mt-4 mb-6">Only the CEO can lift a closure.</p>}

      {past.length > 0 && (
        <>
          <h2 className="text-[15px] font-bold text-[#0b2b35] mb-3">History (lifted)</h2>
          <div className="space-y-2">
            {past.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-[#e8f4f7] opacity-75 p-4">
                <p className="text-[13px] font-semibold text-[#0b2b35]">{fmtDateRange(c.start_date, c.end_date)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Closed {fmtDate(c.closed_at)}{c.closed_by_name ? ` by ${c.closed_by_name}` : ''} · Lifted {c.lifted_at ? fmtDate(c.lifted_at) : ''}{c.lifted_by_name ? ` by ${c.lifted_by_name}` : ''}</p>
                {c.lift_note && <p className="text-[12px] text-gray-500 mt-1">“{c.lift_note}”</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
