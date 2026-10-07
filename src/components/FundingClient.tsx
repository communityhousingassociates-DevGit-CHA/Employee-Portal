'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addFundingNote, deleteFunding, getFundingActivity, saveFunding, setFundingStage } from '@/app/actions/funding'
import {
  FUNDING_STAGES, OPEN_STAGES, STAGE_LABEL,
  type FundingActivity, type FundingInput, type FundingRow, type FundingStage,
} from '@/lib/constants/funding'

const money = (n: number | null | undefined) => (n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US'))
const day = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

const STAGE_BADGE: Record<FundingStage, string> = {
  research: 'bg-gray-100 text-gray-600',
  intro_call: 'bg-sky-50 text-sky-700',
  loi_drafted: 'bg-sky-50 text-sky-700',
  loi_submitted: 'bg-indigo-50 text-indigo-700',
  invited_to_apply: 'bg-indigo-50 text-indigo-700',
  proposal_submitted: 'bg-violet-50 text-violet-700',
  awarded: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-red-50 text-red-700',
  reporting: 'bg-teal-50 text-teal-700',
  skipped: 'bg-gray-100 text-gray-400',
}
const PRIORITY_BADGE: Record<string, string> = { A: 'bg-emerald-100 text-emerald-800', B: 'bg-amber-100 text-amber-800', C: 'bg-gray-100 text-gray-600' }

const EMPTY: FundingInput = { funder: '', priority: 'B', stage: 'research' }

export default function FundingClient({ initialRows }: { initialRows: FundingRow[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [rows, setRows] = useState<FundingRow[]>(initialRows)
  const [stageFilter, setStageFilter] = useState<'active' | 'all' | FundingStage>('active')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [editing, setEditing] = useState<{ id: string | null; form: FundingInput } | null>(null)
  const [activity, setActivity] = useState<FundingActivity[]>([])
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  // Resync when the server sends fresh rows after router.refresh().
  const [seenInitial, setSeenInitial] = useState(initialRows)
  if (seenInitial !== initialRows) { setSeenInitial(initialRows); setRows(initialRows) }
  const [now] = useState(() => Date.now())
  const todayStr = new Date(now).toISOString().slice(0, 10)
  const soonStr = new Date(now + 14 * 864e5).toISOString().slice(0, 10)

  const openRows = rows.filter(r => OPEN_STAGES.includes(r.stage))
  const weighted = openRows.reduce((s, r) => s + (r.ask_amount ?? 0) * ((r.probability ?? 0) / 100), 0)
  const requested = openRows.reduce((s, r) => s + (r.ask_amount ?? 0), 0)
  const awarded = rows.filter(r => r.stage === 'awarded' || r.stage === 'reporting').reduce((s, r) => s + (r.awarded_amount ?? r.ask_amount ?? 0), 0)
  const dueSoon = rows.filter(r => r.next_step_due && OPEN_STAGES.concat('research').includes(r.stage) && r.next_step_due <= soonStr)

  const visible = rows.filter(r => {
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false
    if (stageFilter === 'active') return r.stage !== 'skipped' && r.stage !== 'declined'
    if (stageFilter === 'all') return true
    return r.stage === stageFilter
  })

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function openEdit(r: FundingRow | null) {
    setError(''); setNote(''); setActivity([])
    if (!r) { setEditing({ id: null, form: { ...EMPTY } }); return }
    const { id, updated_at, ...form } = r
    void updated_at
    setEditing({ id, form })
    try { setActivity(await getFundingActivity(id)) } catch { /* log is optional */ }
  }

  function set<K extends keyof FundingInput>(key: K, value: FundingInput[K]) {
    setEditing(e => (e ? { ...e, form: { ...e.form, [key]: value } } : e))
  }

  async function handleSave() {
    if (!editing) return
    setError('')
    try {
      await saveFunding(editing.id, editing.form)
      showToast(editing.id ? 'Funder updated' : 'Funder added')
      setEditing(null)
      startTransition(() => router.refresh())
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Something went wrong') }
  }

  async function handleStage(r: FundingRow, stage: FundingStage) {
    const prev = r.stage
    setRows(rs => rs.map(x => (x.id === r.id ? { ...x, stage } : x)))
    try { await setFundingStage(r.id, stage) } catch (e: unknown) {
      setRows(rs => rs.map(x => (x.id === r.id ? { ...x, stage: prev } : x)))
      showToast(e instanceof Error ? e.message : 'Could not update stage')
    }
  }

  async function handleNote() {
    if (!editing?.id || !note.trim()) return
    try {
      await addFundingNote(editing.id, note)
      setNote('')
      setActivity(await getFundingActivity(editing.id))
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not add note') }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!window.confirm(`Delete ${editing.form.funder} and its activity log? This cannot be undone.`)) return
    try {
      await deleteFunding(editing.id)
      setRows(rs => rs.filter(r => r.id !== editing.id))
      setEditing(null)
      showToast('Funder deleted')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Could not delete') }
  }

  const inputCls = 'w-full px-3 py-2 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white'
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1'

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Executive Funding</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Private grant prospects for permanent supportive housing · visible to Admin and CEO only</p>
        </div>
        <button onClick={() => openEdit(null)} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Add Funder
        </button>
      </div>

      {toast && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4">{toast}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Open requests', value: money(requested), sub: `${openRows.length} funders in motion` },
          { label: 'Weighted pipeline', value: money(weighted), sub: 'ask × probability' },
          { label: 'Awarded', value: money(awarded), sub: 'awarded + reporting' },
          { label: 'Due in 14 days', value: String(dueSoon.length), sub: dueSoon.length ? dueSoon.map(d => d.funder).slice(0, 2).join(', ') : 'nothing urgent' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-[#d4eef2] rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{c.label}</p>
            <p className="text-[22px] font-bold text-[#0b2b35] mt-1">{c.value}</p>
            <p className="text-[12px] text-gray-400 truncate">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value as typeof stageFilter)} className={inputCls + ' !w-auto'}>
          <option value="active">Active (hide declined / not pursuing)</option>
          <option value="all">All stages</option>
          {FUNDING_STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as typeof priorityFilter)} className={inputCls + ' !w-auto'}>
          <option value="all">All priorities</option>
          <option value="A">Priority A</option>
          <option value="B">Priority B</option>
          <option value="C">Priority C</option>
        </select>
      </div>

      <div className="bg-white border border-[#d4eef2] rounded-xl overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-[#d4eef2]">
              <th className="px-4 py-3">Funder</th>
              <th className="px-3 py-3">Pri</th>
              <th className="px-3 py-3">Stage</th>
              <th className="px-3 py-3 text-right">Ask</th>
              <th className="px-3 py-3 text-right">Prob.</th>
              <th className="px-3 py-3">Next step</th>
              <th className="px-3 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No funders match these filters.</td></tr>
            )}
            {visible.map(r => (
              <tr key={r.id} className="border-b border-[#eef7f9] hover:bg-[#f7fcfd] cursor-pointer" onClick={() => openEdit(r)}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#0b2b35]">{r.funder}</p>
                  <p className="text-[11px] text-gray-400">{r.funder_type ?? ''}</p>
                </td>
                <td className="px-3 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[r.priority]}`}>{r.priority}</span></td>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <select value={r.stage} onChange={e => handleStage(r, e.target.value as FundingStage)}
                    className={`text-[12px] font-medium rounded-full px-2 py-1 border-0 ${STAGE_BADGE[r.stage]}`}>
                    {FUNDING_STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3 text-right">{money(r.ask_amount)}</td>
                <td className="px-3 py-3 text-right">{r.probability == null ? '—' : r.probability + '%'}</td>
                <td className="px-3 py-3 max-w-[280px] truncate text-gray-600">{r.next_step ?? '—'}</td>
                <td className={`px-3 py-3 whitespace-nowrap ${r.next_step_due && r.next_step_due < todayStr ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>{day(r.next_step_due)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setEditing(null)}>
          <div className="w-full max-w-[560px] bg-white h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-[18px] font-bold text-[#0b2b35]">{editing.id ? 'Edit funder' : 'Add funder'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-[20px] leading-none" aria-label="Close">×</button>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg px-3 py-2 mb-3">{error}</div>}

            <div className="space-y-3">
              <div><label className={labelCls}>Funder</label><input className={inputCls} value={editing.form.funder} onChange={e => set('funder', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Type</label><input className={inputCls} value={editing.form.funder_type ?? ''} onChange={e => set('funder_type', e.target.value)} /></div>
                <div><label className={labelCls}>Priority</label>
                  <select className={inputCls} value={editing.form.priority ?? 'B'} onChange={e => set('priority', e.target.value as 'A' | 'B' | 'C')}>
                    <option value="A">A: pursue now</option><option value="B">B: pursue next</option><option value="C">C: long shot</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Stage</label>
                  <select className={inputCls} value={editing.form.stage ?? 'research'} onChange={e => set('stage', e.target.value as FundingStage)}>
                    {FUNDING_STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </select></div>
                <div><label className={labelCls}>Owner</label><input className={inputCls} value={editing.form.owner ?? ''} onChange={e => set('owner', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls}>Ask ($)</label><input type="number" min={0} className={inputCls} value={editing.form.ask_amount ?? ''} onChange={e => set('ask_amount', e.target.value === '' ? null : Number(e.target.value))} /></div>
                <div><label className={labelCls}>Probability %</label><input type="number" min={0} max={100} className={inputCls} value={editing.form.probability ?? ''} onChange={e => set('probability', e.target.value === '' ? null : Number(e.target.value))} /></div>
                <div><label className={labelCls}>Awarded ($)</label><input type="number" min={0} className={inputCls} value={editing.form.awarded_amount ?? ''} onChange={e => set('awarded_amount', e.target.value === '' ? null : Number(e.target.value))} /></div>
              </div>
              <div><label className={labelCls}>Purpose of ask</label><input className={inputCls} value={editing.form.purpose ?? ''} onChange={e => set('purpose', e.target.value)} placeholder="e.g. case management gap for PSH residents" /></div>
              <div><label className={labelCls}>Next step</label><input className={inputCls} value={editing.form.next_step ?? ''} onChange={e => set('next_step', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Next step due</label><input type="date" className={inputCls} value={editing.form.next_step_due ?? ''} onChange={e => set('next_step_due', e.target.value)} /></div>
                <div><label className={labelCls}>LOI sent</label><input type="date" className={inputCls} value={editing.form.loi_sent_on ?? ''} onChange={e => set('loi_sent_on', e.target.value)} /></div>
                <div><label className={labelCls}>Proposal due</label><input type="date" className={inputCls} value={editing.form.proposal_due ?? ''} onChange={e => set('proposal_due', e.target.value)} /></div>
                <div><label className={labelCls}>Decision date</label><input type="date" className={inputCls} value={editing.form.decision_date ?? ''} onChange={e => set('decision_date', e.target.value)} /></div>
              </div>
              <div><label className={labelCls}>Fit for CHA</label><textarea rows={3} className={inputCls} value={editing.form.fit_notes ?? ''} onChange={e => set('fit_notes', e.target.value)} /></div>
              <div><label className={labelCls}>Process and timing</label><textarea rows={3} className={inputCls} value={editing.form.process_notes ?? ''} onChange={e => set('process_notes', e.target.value)} /></div>
              <div><label className={labelCls}>Eligibility flags</label><textarea rows={2} className={inputCls} value={editing.form.eligibility_notes ?? ''} onChange={e => set('eligibility_notes', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Source link</label><input className={inputCls} value={editing.form.source_url ?? ''} onChange={e => set('source_url', e.target.value)} /></div>
                <div><label className={labelCls}>Verification</label><input className={inputCls} value={editing.form.verification ?? ''} onChange={e => set('verification', e.target.value)} /></div>
              </div>
              {editing.form.source_url && /^https?:\/\//.test(editing.form.source_url) && (
                <a href={editing.form.source_url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#02ACC0] hover:underline">Open funder page ↗</a>
              )}
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button onClick={handleSave} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e]">Save</button>
              <button onClick={() => setEditing(null)} className="text-[13px] px-4 py-2 rounded-lg border border-[#d4eef2] text-gray-600">Cancel</button>
              {editing.id && <button onClick={handleDelete} className="ml-auto text-[12px] text-red-600 hover:underline">Delete funder</button>}
            </div>

            {editing.id && (
              <div className="mt-8 border-t border-[#d4eef2] pt-4">
                <h3 className="text-[13px] font-bold text-[#0b2b35] mb-2">Activity log</h3>
                <div className="flex gap-2 mb-3">
                  <input className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="Log a call, email, or decision" onKeyDown={e => { if (e.key === 'Enter') handleNote() }} />
                  <button onClick={handleNote} className="text-[13px] font-semibold px-3 rounded-lg border border-[#02ACC0] text-[#02ACC0]">Add</button>
                </div>
                <ul className="space-y-2">
                  {activity.length === 0 && <li className="text-[12px] text-gray-400">No activity yet.</li>}
                  {activity.map(a => (
                    <li key={a.id} className="text-[12px] text-gray-700 bg-[#f7fcfd] rounded-lg px-3 py-2">
                      {a.note}
                      <span className="block text-[11px] text-gray-400 mt-0.5">{a.author_name ?? 'Unknown'} · {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
