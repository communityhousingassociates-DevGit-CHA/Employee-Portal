'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  parseBalanceFileForUpdate, compareBalancesToSage, postBalanceAdjustments,
  type SnapshotRow, type ComparisonResult,
} from '@/app/actions/balances'
import type { BalanceFileRow } from '@/lib/import/balance-update-parser'
import { fmtDate } from '@/lib/format-date'

const inputCls = 'px-3 py-2.5 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white'
const n = (v: number) => Number(v.toFixed(2))

function Var({ v }: { v: number }) {
  if (v === 0) return <span className="text-gray-300">0</span>
  return <span className={`font-semibold ${v > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{v > 0 ? '+' : ''}{n(v)}</span>
}

export default function BalanceReconcileClient({ snapshotAsOf, snapshots, employees }: { snapshotAsOf: string | null; snapshots: SnapshotRow[]; employees: { id: string; name: string }[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  // ---- reconcile with Sage
  const [asOf, setAsOf] = useState(snapshotAsOf ?? '')
  const [fileRows, setFileRows] = useState<BalanceFileRow[]>([])
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')

  // ---- manual adjustment
  const [adj, setAdj] = useState({ employeeId: '', pto: '', sick: '', vacation: '', date: new Date().toISOString().slice(0, 10), reason: '' })

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 4000) }

  async function handleCompare() {
    const file = fileRef.current?.files?.[0]
    if (!file || !asOf) { setError('Choose the Sage file and the date it is as of'); return }
    setBusy(true); setError(''); setResult(null)
    try {
      const fd = new FormData(); fd.set('file', file)
      const rows = await parseBalanceFileForUpdate(fd)
      setFileRows(rows)
      const res = await compareBalancesToSage(rows, asOf)
      setResult(res)
      setPicked(new Set(res.rows.filter(r => r.variance.pto || r.variance.sick || r.variance.vacation).map(r => r.employeeId)))
      setReason(`Reconciliation to Sage as of ${fmtDate(asOf)}`)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Couldn’t compare that file') } finally { setBusy(false) }
  }

  async function handlePostVariances() {
    if (!result) return
    setBusy(true); setError('')
    try {
      const items = result.rows.filter(r => picked.has(r.employeeId)).map(r => ({ employeeId: r.employeeId, pto: r.variance.pto, sick: r.variance.sick, vacation: r.variance.vacation }))
      const res = await postBalanceAdjustments(items, asOf, reason)
      showToast(`Adjusted ${res.applied} employee${res.applied === 1 ? '' : 's'} to match Sage`)
      setResult(null); setFileRows([]); if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  async function handleManual() {
    setBusy(true); setError('')
    try {
      const res = await postBalanceAdjustments([{ employeeId: adj.employeeId, pto: Number(adj.pto) || 0, sick: Number(adj.sick) || 0, vacation: Number(adj.vacation) || 0 }], adj.date, adj.reason)
      showToast(`Adjustment posted (${res.applied})`)
      setAdj(a => ({ ...a, pto: '', sick: '', vacation: '', reason: '' }))
      router.refresh()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  const varianceRows = result?.rows.filter(r => r.variance.pto || r.variance.sick || r.variance.vacation) ?? []

  return (
    <div className="max-w-5xl mt-10 space-y-6">
      {toast && <div className="fixed top-4 right-4 z-50 bg-[#0b2b35] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-lg">{toast}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5">{error}</div>}

      <div>
        <h2 className="text-[18px] font-bold text-[#0b2b35]">Reconcile with Sage</h2>
        <p className="text-[13px] text-gray-500 mt-0.5">
          The portal is the live ledger; Sage catches up once it has processed a period. Compare Sage&apos;s balances to the portal&apos;s balances <strong>as of the same date</strong> — nothing is overwritten, and differences can be posted as documented adjustments.
        </p>
      </div>

      {/* ---------- closing snapshots ---------- */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Balances at last close</p>
        {!snapshotAsOf ? (
          <p className="text-[13px] text-gray-400">No snapshot yet — one is saved automatically each time accounting closes a period.</p>
        ) : (
          <>
            <p className="text-[12px] text-gray-500 mb-3">As of <strong>{fmtDate(snapshotAsOf)}</strong> (the last closed date) — the numbers Sage should show once it has processed that period — beside today&apos;s live balances. Hours change since then from accruals, leave taken, and adjustments.</p>
            <div className="overflow-x-auto border border-[#d4eef2] rounded-xl">
              <table className="w-full text-[12px] min-w-[720px]">
                <thead>
                  <tr className="bg-[#f9fefe] border-b border-[#d4eef2] text-left text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2 font-semibold">Employee</th>
                    {['PTO', 'Sick', 'Vacation'].map(h => <th key={h} className="px-4 py-2 font-semibold">{h}: at close → today</th>)}
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map(r => (
                    <tr key={r.employeeId} className="border-b border-[#f0f7f8] last:border-0">
                      <td className="px-4 py-2 font-medium text-[#0b2b35]">{r.name}</td>
                      {(['pto', 'sick', 'vacation'] as const).map(k => {
                        const parts = [r.since.accrued[k] ? `+${n(r.since.accrued[k])} accrued` : '', r.since.leaveTaken[k] ? `−${n(r.since.leaveTaken[k])} leave` : '', r.since.adjustments[k] ? `${r.since.adjustments[k] > 0 ? '+' : ''}${n(r.since.adjustments[k])} adj.` : ''].filter(Boolean)
                        return (
                          <td key={k} className="px-4 py-2 align-top">
                            <span className="text-gray-400">{n(r.snapshot[k])}</span> → <span className="font-semibold text-[#0b2b35]">{n(r.live[k])}</span>
                            {parts.length > 0 && <span className="block text-[10px] text-gray-400">{parts.join(' · ')}</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ---------- compare ---------- */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Compare a Sage balance file</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Sage balances are as of</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className={inputCls} />
            <span className="text-[11px] text-gray-400">Usually the last day of the period Sage just processed.{snapshotAsOf ? ` (Latest closing snapshot: ${fmtDate(snapshotAsOf)}.)` : ''}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">File (.xlsx or .csv)</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="text-[13px] py-2" />
          </div>
        </div>
        <button onClick={handleCompare} disabled={busy} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">{busy && !result ? 'Comparing…' : 'Compare'}</button>

        {result && (
          <div className="mt-5">
            <div className="flex flex-wrap gap-2 text-[12px] mb-3">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{result.rows.length - varianceRows.length} match</span>
              <span className={`px-2.5 py-1 rounded-full font-semibold ${varianceRows.length ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{varianceRows.length} differ</span>
              {result.problems.length > 0 && <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-600 font-semibold">{result.problems.length} unmatched</span>}
              <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">Portal side: {result.source === 'snapshot' ? 'closing snapshot' : 'rebuilt from history'}</span>
            </div>

            {varianceRows.length === 0 ? (
              <p className="text-[13px] text-emerald-700">✓ Every balance in the file matches the portal as of {fmtDate(result.asOf)}.</p>
            ) : (
              <div className="overflow-x-auto border border-[#d4eef2] rounded-xl">
                <table className="w-full text-[12px] min-w-[760px]">
                  <thead>
                    <tr className="bg-[#f9fefe] border-b border-[#d4eef2] text-left text-[10px] uppercase tracking-wide text-gray-400">
                      <th className="px-3 py-2 w-8" />
                      <th className="px-3 py-2 font-semibold">Employee</th>
                      {['PTO', 'Sick', 'Vacation'].map(h => <th key={h} className="px-3 py-2 font-semibold">{h}: portal → Sage (diff)</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {varianceRows.map(r => (
                      <tr key={r.employeeId} className="border-b border-[#f0f7f8] last:border-0">
                        <td className="px-3 py-2"><input type="checkbox" checked={picked.has(r.employeeId)} onChange={() => setPicked(p => { const x = new Set(p); if (x.has(r.employeeId)) x.delete(r.employeeId); else x.add(r.employeeId); return x })} /></td>
                        <td className="px-3 py-2 font-medium text-[#0b2b35]">{r.employeeName}</td>
                        {(['pto', 'sick', 'vacation'] as const).map(k => (
                          <td key={k} className="px-3 py-2"><span className="text-gray-400">{n(r.portal[k])}</span> → {n(r.file[k])} (<Var v={r.variance[k]} />)</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.problems.length > 0 && <p className="text-[11px] text-red-500 mt-2">Not compared: {result.problems.map(p => `${p.fileName} (${p.message})`).join('; ')}.</p>}
            {result.notInFile.length > 0 && <p className="text-[11px] text-gray-400 mt-1">Not in the file: {result.notInFile.join(', ')}.</p>}

            {varianceRows.length > 0 && (
              <div className="mt-4 border border-[#d4eef2] rounded-lg p-3 bg-[#f8fcfd]">
                <p className="text-[12px] text-[#0b2b35] mb-2">Investigate first — a difference usually means leave was recorded in one system and not the other. To bring the portal in line with Sage for the checked rows, post the difference as a documented adjustment (effective {fmtDate(asOf)}):</p>
                <input value={reason} onChange={e => setReason(e.target.value)} className={`${inputCls} w-full mb-2`} placeholder="Reason" />
                <button onClick={handlePostVariances} disabled={busy || picked.size === 0 || !reason.trim()} className="bg-amber-500 text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-40">
                  {busy ? 'Posting…' : `Post adjustments for ${picked.size} employee${picked.size === 1 ? '' : 's'}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- manual adjustment ---------- */}
      <div className="bg-white rounded-xl border border-[#d4eef2] p-5">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Adjust one balance</p>
        <p className="text-[12px] text-gray-500 mb-3">For prior-period corrections. Enter the change in hours (negative to reduce). It never reopens a closed period or edits a timesheet, and it&apos;s recorded with your reason.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Employee</label>
            <select value={adj.employeeId} onChange={e => setAdj(a => ({ ...a, employeeId: e.target.value }))} className={inputCls}>
              <option value="">— Choose —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          {([['pto', 'PTO ±hrs'], ['sick', 'Sick ±hrs'], ['vacation', 'Vacation ±hrs']] as const).map(([k, label]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">{label}</label>
              <input type="number" step="0.01" value={adj[k]} onChange={e => setAdj(a => ({ ...a, [k]: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Effective date</label>
            <input type="date" value={adj.date} onChange={e => setAdj(a => ({ ...a, date: e.target.value }))} className={inputCls} />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">Reason (required)</label>
            <input value={adj.reason} onChange={e => setAdj(a => ({ ...a, reason: e.target.value }))} placeholder="e.g. Sick day 09-15 recorded in Sage only" className={inputCls} />
          </div>
        </div>
        <button onClick={handleManual} disabled={busy || !adj.employeeId || !adj.reason.trim() || !(Number(adj.pto) || Number(adj.sick) || Number(adj.vacation))}
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">Post adjustment</button>
      </div>
    </div>
  )
}
