'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  parseBalanceFileForUpdate, previewBalanceUpdate, applyBalanceUpdate, saveAccrualSettings, runAccrualsNow,
  type BalancePreview, type BalancePreviewRow, type AccrualState,
} from '@/app/actions/balances'
import type { BalanceFileRow } from '@/lib/import/balance-update-parser'
import { fmtDate, fmtDateRange } from '@/lib/format-date'
import type { PayPeriod } from '@/lib/pay-periods'

type HistoryItem = { batchId: string; asOf: string; file: string | null; note: string | null; at: string; by: string | null; employees: number }

const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white'
const hrs = (n: number) => `${Number(n.toFixed(2))}`

function Delta({ from, to }: { from: number; to: number }) {
  const d = Math.round((to - from) * 100) / 100
  return (
    <span className="whitespace-nowrap">
      <span className="text-gray-400">{hrs(from)}</span> → <span className="font-semibold text-[#0b2b35]">{hrs(to)}</span>
      {d !== 0 && <span className={`ml-1 text-[10px] font-semibold ${d > 0 ? 'text-emerald-600' : 'text-red-500'}`}>({d > 0 ? '+' : ''}{hrs(d)})</span>}
    </span>
  )
}

export default function BalanceUpdateClient({ accrual, history, periods, currentStart }: { accrual: AccrualState; history: HistoryItem[]; periods: PayPeriod[]; currentStart: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [asOf, setAsOf] = useState('2026-09-13')
  const [note, setNote] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileRows, setFileRows] = useState<BalanceFileRow[]>([])
  const [preview, setPreview] = useState<BalancePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const [firstPeriod, setFirstPeriod] = useState(accrual.firstPeriodStart ?? '')
  const [accrualMsg, setAccrualMsg] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  async function handleFile() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setBusy(true); setError(''); setPreview(null); setConfirmed(false)
    try {
      const fd = new FormData(); fd.set('file', file)
      const rows = await parseBalanceFileForUpdate(fd)
      setFileName(file.name); setFileRows(rows)
      setPreview(await previewBalanceUpdate(rows, asOf))
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Couldn’t read that file') } finally { setBusy(false) }
  }

  async function refreshPreview(nextAsOf: string) {
    setAsOf(nextAsOf)
    if (!fileRows.length || !/^\d{4}-\d{2}-\d{2}$/.test(nextAsOf)) return
    try { setPreview(await previewBalanceUpdate(fileRows, nextAsOf)); setConfirmed(false) } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
  }

  const okRows = (preview?.rows ?? []).filter((r): r is BalancePreviewRow & { employeeId: string; file: NonNullable<BalancePreviewRow['file']> } => r.status === 'ok' && !!r.employeeId && !!r.file)
  const problemRows = (preview?.rows ?? []).filter(r => r.status !== 'ok')
  const warnCount = okRows.filter(r => r.flags.length > 0).length

  async function handleApply() {
    setBusy(true); setError('')
    try {
      const res = await applyBalanceUpdate(okRows.map(r => ({ employeeId: r.employeeId, pto: r.file.pto, sick: r.file.sick, vacation: r.file.vacation })), asOf, note, fileName)
      showToast(`Balances overridden for ${res.applied} employee${res.applied === 1 ? '' : 's'}`)
      setPreview(null); setFileRows([]); setFileName(''); setConfirmed(false); setNote('')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to apply') } finally { setBusy(false) }
  }

  async function handleAccrualSave(enabled: boolean) {
    setBusy(true); setAccrualMsg(''); setError('')
    try {
      await saveAccrualSettings(enabled ? firstPeriod : accrual.firstPeriodStart, enabled)
      showToast(enabled ? 'Accruals switched on' : 'Accruals switched off')
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  async function handleRunNow() {
    setBusy(true); setAccrualMsg(''); setError('')
    try {
      const s = await runAccrualsNow()
      setAccrualMsg(`Credited ${s.processed} employee accrual${s.processed === 1 ? '' : 's'} across ${s.periods.length} period${s.periods.length === 1 ? '' : 's'}${s.errors.length ? ` — ${s.errors.length} error(s): ${s.errors[0]}` : ''}.`)
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  return (
    <div className="max-w-5xl">
      {toast && <div className="fixed top-4 right-4 z-50 bg-[#0b2b35] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-lg">{toast}</div>}

      <h1 className="text-[22px] font-bold text-[#0b2b35]">Leave Balances</h1>
      <p className="text-[13px] text-gray-500 mt-0.5 mb-6">
        Override PTO, Sick, and Vacation totals from a file of CHA&apos;s current balances, then switch on the portal&apos;s accruals. Every change is previewed first and recorded.
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>}

      {/* ---------- Step 1: override ---------- */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-5 mb-6">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">1 · Override balances from a file</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Balances are as of</label>
            <input type="date" value={asOf} onChange={e => refreshPreview(e.target.value)} className={inputCls} />
            <span className="text-[11px] text-gray-400">Approved leave dated on/after this day is taken back off the file&apos;s totals.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Note <span className="normal-case font-normal text-gray-400">(optional)</span></label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Balances from CHA payroll as of 09-13-2026" className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mb-2">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">File (.xlsx or .csv)</label>
          <div className="flex gap-3 items-center flex-wrap">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="text-[13px]" onChange={() => { setPreview(null); setConfirmed(false) }} />
            <button onClick={handleFile} disabled={busy} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">{busy && !preview ? 'Reading…' : 'Read & preview'}</button>
          </div>
          <span className="text-[11px] text-gray-400">Accepts CHA&apos;s Leave Balance Validation workbook, or any sheet with a Name or Email column plus PTO, Sick, and Vacation columns. A blank balance is left unchanged.</span>
        </div>

        {preview && (
          <div className="mt-5">
            <div className="flex flex-wrap gap-3 text-[12px] mb-3">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{okRows.length} matched</span>
              {warnCount > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">{warnCount} with notes</span>}
              {problemRows.length > 0 && <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-600 font-semibold">{problemRows.length} not applied</span>}
              {preview.notInFile.length > 0 && <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">{preview.notInFile.length} employees not in the file (unchanged)</span>}
            </div>

            <div className="border border-[#d4eef2] rounded-xl overflow-x-auto">
              <table className="w-full text-[12px] min-w-[760px]">
                <thead>
                  <tr className="bg-[#f9fefe] border-b border-[#d4eef2] text-left text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2 font-semibold">Employee</th>
                    <th className="px-4 py-2 font-semibold">PTO (hrs)</th>
                    <th className="px-4 py-2 font-semibold">Sick (hrs)</th>
                    <th className="px-4 py-2 font-semibold">Vacation (hrs)</th>
                    <th className="px-4 py-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {okRows.map(r => (
                    <tr key={r.employeeId} className="border-b border-[#f0f7f8] last:border-0 align-top">
                      <td className="px-4 py-2.5 font-medium text-[#0b2b35]">{r.employeeName}{r.fileName !== r.employeeName && <span className="block text-[10px] font-normal text-gray-400">file: {r.fileName}</span>}</td>
                      <td className="px-4 py-2.5"><Delta from={r.current!.pto} to={r.final!.pto} /></td>
                      <td className="px-4 py-2.5"><Delta from={r.current!.sick} to={r.final!.sick} /></td>
                      <td className="px-4 py-2.5"><Delta from={r.current!.vacation} to={r.final!.vacation} /></td>
                      <td className="px-4 py-2.5 text-amber-700">{r.flags.length ? r.flags.join(' · ') : <span className="text-gray-300">—</span>}</td>
                    </tr>
                  ))}
                  {problemRows.map(r => (
                    <tr key={`p${r.rowIndex}`} className="border-b border-[#f0f7f8] last:border-0 bg-red-50/40">
                      <td className="px-4 py-2.5 font-medium text-[#0b2b35]">{r.fileName}</td>
                      <td colSpan={4} className="px-4 py-2.5 text-red-600">Not applied — {r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.notInFile.length > 0 && <p className="text-[11px] text-gray-400 mt-2">Not in the file, so unchanged: {preview.notInFile.map(e => e.name).join(', ')}.</p>}

            <label className="flex items-start gap-2.5 mt-4 text-[13px] text-[#0b2b35] cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#02ACC0]" />
              <span>I&apos;ve reviewed the changes. Overwrite {okRows.length} employee{okRows.length === 1 ? '' : 's'}&apos; balances with these totals (as of {asOf ? fmtDate(asOf) : '—'}).</span>
            </label>
            <button onClick={handleApply} disabled={!confirmed || busy || okRows.length === 0}
              className="mt-3 bg-red-500 text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed">
              {busy ? 'Applying…' : `Override ${okRows.length} balance${okRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>

      {/* ---------- Step 2: accruals ---------- */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-5 mb-6">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">2 · Accruals</p>
        <p className="text-[13px] text-[#0b2b35] mb-1">
          Status: <span className={`font-semibold ${accrual.enabled ? 'text-emerald-600' : 'text-amber-600'}`}>{accrual.enabled ? 'ON' : 'OFF'}</span>
          {accrual.enabled && accrual.firstPeriodStart && <> · accruing from the period starting {fmtDate(accrual.firstPeriodStart)}</>}
        </p>
        <p className="text-[12px] text-gray-500 mb-4">
          When on, every pay period from the one you choose onward is credited PTO (by tenure) and Sick hours, once per period. Choose the first period <strong>after</strong> the one your balances already include — otherwise hours are added twice.
          {accrual.periodsCredited > 0 && <> {accrual.periodsCredited} period{accrual.periodsCredited === 1 ? '' : 's'} credited so far (latest {accrual.lastCreditedPeriod ? fmtDate(accrual.lastCreditedPeriod) : '—'}).</>}
        </p>
        <div className="flex flex-col gap-1.5 mb-3 max-w-md">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">First pay period to accrue</label>
          <select value={firstPeriod} onChange={e => setFirstPeriod(e.target.value)} className={inputCls}>
            <option value="">— Choose a pay period —</option>
            {[...periods].reverse().map(p => <option key={p.start} value={p.start}>{fmtDateRange(p.start, p.end)}{p.start === currentStart ? ' (current)' : ''}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {!accrual.enabled ? (
            <button onClick={() => handleAccrualSave(true)} disabled={!firstPeriod || busy} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">Switch accruals on</button>
          ) : (
            <>
              <button onClick={() => handleAccrualSave(true)} disabled={!firstPeriod || busy} className="border border-[#d4eef2] text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#f0f7f8] disabled:opacity-40">Update first period</button>
              <button onClick={handleRunNow} disabled={busy} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">Run accruals now</button>
              <button onClick={() => handleAccrualSave(false)} disabled={busy} className="border border-amber-300 text-amber-700 text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-amber-50 disabled:opacity-40">Switch off</button>
            </>
          )}
        </div>
        {accrualMsg && <p className="text-[12px] text-emerald-700 mt-3">{accrualMsg}</p>}
        <p className="text-[11px] text-gray-400 mt-3">
          The daily job also runs these automatically{accrual.cronConfigured ? '' : ' — but its secret isn’t configured in Vercel yet, so use “Run accruals now” until it is'}. Re-running never double-credits a period.
        </p>
      </div>

      {/* ---------- history ---------- */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Recent overrides</p>
          <ul className="space-y-2">
            {history.map(h => (
              <li key={h.batchId} className="text-[12px] border-l-2 border-[#d4eef2] pl-3">
                <p className="font-semibold text-[#0b2b35]">{h.employees} employee{h.employees === 1 ? '' : 's'} · balances as of {fmtDate(h.asOf)} <span className="font-normal text-gray-400">· applied {fmtDate(h.at)}{h.by ? ` by ${h.by}` : ''}</span></p>
                {(h.file || h.note) && <p className="text-gray-500 mt-0.5">{[h.file, h.note].filter(Boolean).join(' — ')}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
