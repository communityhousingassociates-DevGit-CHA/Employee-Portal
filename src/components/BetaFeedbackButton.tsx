'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { reportIssue } from '@/app/actions/report-issue'
import { errMsg } from '@/lib/user-error'

const KINDS = [
  { id: 'Something is broken', hint: 'What did you do, what happened, and what did you expect?' },
  { id: 'Something is missing', hint: 'What did you need to do that the portal could not do?' },
  { id: 'Idea', hint: 'What would make your work easier or faster?' },
  { id: 'Question', hint: 'What were you trying to figure out?' },
]

/** Floating "Give feedback" button, bottom right on every portal page. Goes through the same ticket flow as Report an issue, labelled as beta feedback from the Employee Portal. */
export default function BetaFeedbackButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState(KINDS[0].id)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const hint = KINDS.find(k => k.id === kind)!.hint

  async function send() {
    setBusy(true); setError('')
    try {
      const r = await reportIssue({ category: 'other', description: text, page_url: pathname, beta_feedback_kind: kind })
      setSent(r?.ticket ?? 'sent'); setText('')
    } catch (e: unknown) {
      setError(errMsg(e, 'Something went wrong'))
    } finally { setBusy(false) }
  }

  function close() { setOpen(false); setSent(null); setError('') }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 rounded-full bg-[#0b2b35] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg hover:bg-[#0b2b35]/90 print:hidden">
        Give feedback
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Give feedback">
          <div className="w-full max-w-md rounded-xl bg-white p-5 text-[#0b2b35] shadow-xl keep-light">
            {sent ? (
              <>
                <p className="text-[14px] font-semibold">Thank you. Your feedback was sent and will be read.</p>
                {sent !== 'sent' && <p className="mt-1 text-[13px]">Your tracking number is <strong>{sent}</strong>.</p>}
                <button onClick={close} className="mt-4 rounded-lg bg-[#02ACC0] px-4 py-2 text-[13px] font-semibold text-white">Close</button>
              </>
            ) : (
              <>
                <h2 className="text-[16px] font-bold">Help us make the portal better</h2>
                <p className="mt-1 text-[12px] text-gray-600">Pick the closest type, say what you were trying to do, what happened and what you expected. We include the page you are on automatically. One topic per message works best. Please do not type passwords.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {KINDS.map(k => (
                    <button key={k.id} type="button" onClick={() => setKind(k.id)}
                      className={`rounded-md border px-3 py-2 text-left text-[13px] ${kind === k.id ? 'border-[#02ACC0] bg-[#e6f7f9] font-semibold' : 'border-gray-200 hover:bg-gray-50'}`}>{k.id}</button>
                  ))}
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={hint}
                  className="mt-3 w-full rounded-lg border border-[#d4eef2] px-3 py-2 text-[14px] focus:border-[#02ACC0] focus:outline-none" />
                {error && <p role="alert" className="mt-2 text-[12px] text-red-600">{error}</p>}
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={close} className="rounded-lg px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-100">Cancel</button>
                  <button onClick={send} disabled={busy || text.trim().length < 5} className="rounded-lg bg-[#02ACC0] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send feedback'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
