'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptSuggestion, dismissSuggestion, runFundingSearch } from '@/app/actions/funding'
import { GEO_LABEL, safeUrl, type FundingSuggestion, type SearchStatus } from '@/lib/constants/funding'

const PRIORITY_BADGE: Record<string, string> = { A: 'bg-[#02ACC0] text-white', B: 'bg-[#e0f5f8] text-[#028a9e]', C: 'bg-[#f0f7f8] text-gray-500' }
const day = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null)
const inputCls = 'w-full px-3 py-2 border border-[#d4eef2] rounded-lg text-[13px] focus:outline-none focus:border-[#02ACC0] bg-white'

export default function FundingSuggestions({ initialSuggestions, status }: { initialSuggestions: FundingSuggestion[]; status: SearchStatus }) {
  const router = useRouter()
  const [items, setItems] = useState(initialSuggestions)
  const [focus, setFocus] = useState('')
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // Resync when the server sends fresh rows after router.refresh().
  const [seenInitial, setSeenInitial] = useState(initialSuggestions)
  if (seenInitial !== initialSuggestions) { setSeenInitial(initialSuggestions); setItems(initialSuggestions) }

  const limitReached = status.runsToday >= status.dailyLimit

  async function handleRun() {
    setMessage(null); setRunning(true)
    try {
      const { added } = await runFundingSearch(focus)
      setMessage({ kind: 'ok', text: added ? `${added} new ${added === 1 ? 'candidate' : 'candidates'} ready for review.` : 'Search finished with no new credible candidates.' })
      router.refresh()
    } catch (e: unknown) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Search failed' })
    } finally { setRunning(false) }
  }

  async function handle(s: FundingSuggestion, action: 'add' | 'dismiss') {
    try {
      await (action === 'add' ? acceptSuggestion(s.id) : dismissSuggestion(s.id))
      setItems(xs => xs.filter(x => x.id !== s.id))
      setMessage({ kind: 'ok', text: action === 'add' ? `${s.funder} added to the pipeline as Research.` : `${s.funder} dismissed.` })
      router.refresh()
    } catch (e: unknown) { setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not update' }) }
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-gray-500 max-w-[80ch]">
        An AI agent searches the web for funders that could fit CHA and checks geography, intake and eligibility. Results wait here for your review and nothing enters the pipeline until you add it.
        Every candidate links to the funder&apos;s own page and says what was and was not verified. Confirm details with the funder before outreach.
      </p>

      {!status.configured && (
        <div className="bg-[#fff8e6] border border-amber-200 text-[#0b2b35] text-[13px] rounded-lg px-4 py-3 max-w-[85ch]">
          The search is built but not switched on: the portal needs an Anthropic API key (ANTHROPIC_API_KEY) in its environment settings.
        </div>
      )}
      {message && (
        <div className={`text-[13px] rounded-lg px-4 py-2.5 border ${message.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{message.text}</div>
      )}

      <div className="bg-white border border-[#d4eef2] rounded-xl p-4 shadow-sm">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Search focus (optional)</label>
        <div className="flex flex-wrap gap-2">
          <input className={inputCls + ' flex-1 min-w-[240px]'} value={focus} onChange={e => setFocus(e.target.value)} disabled={running}
            placeholder="e.g. Maryland health plans, federal behavioral health, bank foundations" maxLength={300} />
          <button onClick={handleRun} disabled={running || !status.configured || limitReached}
            className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-50 disabled:cursor-not-allowed">
            {running ? 'Searching…' : 'Find new funders'}
          </button>
        </div>
        <p className="text-[12px] text-gray-500 mt-2">
          {running ? 'This usually takes one to three minutes. Keep this page open.' : `${status.runsToday} of ${status.dailyLimit} searches used in the last 24 hours.`}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-[13px] text-gray-400 py-6 text-center">No suggestions waiting for review.</p>
      ) : (
        <div className="space-y-3">
          {items.map(s => (
            <div key={s.id} className="bg-white border border-[#d4eef2] rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[s.priority]}`}>{s.priority}</span>
                    <h3 className="text-[15px] font-bold text-[#0b2b35]">{s.funder}</h3>
                  </div>
                  <p className="text-[12px] text-gray-400 mt-0.5">{[GEO_LABEL[s.geography], s.funder_type, s.ask_size_published].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handle(s, 'add')} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#028a9e]">Add to pipeline</button>
                  <button onClick={() => handle(s, 'dismiss')} className="text-[13px] px-3 py-1.5 rounded-lg border border-[#d4eef2] text-gray-600 hover:bg-[#f0f7f8]">Dismiss</button>
                </div>
              </div>
              <dl className="mt-3 grid sm:grid-cols-[130px_1fr] gap-x-4 gap-y-2 text-[13px]">
                {([['Fit', s.fit_notes], ['Process', s.process_notes], ['Watch out for', s.eligibility_notes], ['Next step', [s.next_step, day(s.next_step_due) && `due ${day(s.next_step_due)}`].filter(Boolean).join(' · ') || null], ['Verified', s.verification]] as [string, string | null][])
                  .filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="contents"><dt className="text-gray-500 font-semibold">{k}</dt><dd className="text-gray-800 break-words">{v}</dd></div>
                  ))}
              </dl>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px]">
                {([['Website', s.website_url], ['Application / guidelines', s.application_url], ['Source page', s.source_url]] as [string, string | null][])
                  .filter(([, u]) => safeUrl(u)).map(([label, u]) => (
                    <a key={label} href={safeUrl(u)!} target="_blank" rel="noopener noreferrer" className="text-[#02ACC0] hover:underline">{label} ↗</a>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
