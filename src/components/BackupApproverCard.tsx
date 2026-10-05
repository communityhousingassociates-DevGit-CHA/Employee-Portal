'use client'

import { errMsg } from '@/lib/user-error'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setBackupApprover, revokeBackupApprover, type BackupApprover, type BackupCandidate } from '@/app/actions/delegation'

function fmt(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** The CEO's panel for naming a backup approver (e.g. Carrileen) for a date range while he's away. */
export default function BackupApproverCard({ backups, candidates, today }: { backups: BackupApprover[]; candidates: BackupCandidate[]; today: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [delegateId, setDelegateId] = useState(candidates[0]?.id ?? '')
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true); setError('')
    try { await setBackupApprover(delegateId, startsOn, endsOn, note); setOpen(false); setNote(''); router.refresh() }
    catch (e: unknown) { setError(errMsg(e, 'Could not save')) }
    setBusy(false)
  }
  async function revoke(id: string) {
    setBusy(true); setError('')
    try { await revokeBackupApprover(id); router.refresh() }
    catch (e: unknown) { setError(errMsg(e, 'Could not revoke')) }
    setBusy(false)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[#0b2b35]">Backup approver</p>
          <p className="text-[12px] text-gray-500">Final approval is yours. While you&apos;re away you can let a manager decide in your place for a set period — it ends on its own.</p>
        </div>
        {!open && candidates.length > 0 && (
          <button onClick={() => setOpen(true)} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[#02ACC0] text-white hover:bg-[#028a9e]">Name a backup</button>
        )}
      </div>

      {backups.length > 0 && (
        <ul className="mt-3 space-y-2">
          {backups.map(b => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px] bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span><strong>{b.delegate_name}</strong> can approve for you {fmt(b.starts_on)} – {fmt(b.ends_on)}{b.starts_on > today ? ' (upcoming)' : ' (active now)'}{b.note ? ` · ${b.note}` : ''}</span>
              <button disabled={busy} onClick={() => revoke(b.id)} className="font-semibold text-red-500 hover:underline disabled:opacity-50">End now</button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-4 items-end">
          <label className="text-[11px] text-gray-500">Backup
            <select value={delegateId} onChange={e => setDelegateId(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] text-gray-800">
              {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-gray-500">From
            <input type="date" value={startsOn} min={today} onChange={e => { setStartsOn(e.target.value); if (endsOn < e.target.value) setEndsOn(e.target.value) }} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] text-gray-800" />
          </label>
          <label className="text-[11px] text-gray-500">Through
            <input type="date" value={endsOn} min={startsOn} onChange={e => setEndsOn(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] text-gray-800" />
          </label>
          <label className="text-[11px] text-gray-500">Note (optional)
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={120} placeholder="e.g. Out of office" className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] text-gray-800" />
          </label>
          <div className="sm:col-span-4 flex gap-2">
            <button disabled={busy || !delegateId} onClick={save} className="text-[12px] font-semibold px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save backup'}</button>
            <button disabled={busy} onClick={() => setOpen(false)} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
          <p className="sm:col-span-4 text-[11px] text-gray-400">A backup can&apos;t decide her own items or yours, and each decision she makes is marked &ldquo;as backup for you&rdquo; and sent to you.</p>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
