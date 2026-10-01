'use client'

import { ON_BEHALF_REASONS, ON_BEHALF_NOTE_MIN_LENGTH, onBehalfProblem } from '@/lib/constants/on-behalf'

/**
 * Shown whenever an admin is completing a form FOR another employee. It makes the exception unmistakable and collects the
 * two things the audit trail requires: a reason code and notes. The server re-checks both.
 */
export default function OnBehalfPanel({
  employeeName,
  actorName,
  what,
  reasonCode,
  note,
  onChange,
}: {
  employeeName: string
  actorName: string
  what: 'leave request' | 'timesheet' | 'expense'
  reasonCode: string
  note: string
  onChange: (v: { reasonCode: string; note: string }) => void
}) {
  const problem = onBehalfProblem({ reasonCode, note })
  const touched = reasonCode !== '' || note !== ''
  return (
    <div role="region" aria-label="Completing on behalf of an employee" className="mb-5 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="text-[18px] leading-none mt-0.5">⚠️</span>
        <div>
          <p className="text-[14px] font-bold text-amber-900">Exception — completing this {what} on behalf of {employeeName}</p>
          <p className="text-[12px] text-amber-800 mt-0.5">
            This is not the employee submitting directly. It will be recorded as submitted by <strong>{actorName}</strong> on {employeeName}&rsquo;s behalf,
            with the reason below, and {employeeName} will be notified.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-amber-900" htmlFor="on-behalf-reason">Reason code <span className="text-red-500">*</span></label>
          <select id="on-behalf-reason" value={reasonCode} onChange={e => onChange({ reasonCode: e.target.value, note })}
            className="px-3 py-2.5 border border-amber-300 rounded-lg text-[13px] bg-white focus:outline-none focus:border-amber-500">
            <option value="">Select a reason…</option>
            {ON_BEHALF_REASONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide font-semibold text-amber-900" htmlFor="on-behalf-note">Notes for the audit trail <span className="text-red-500">*</span></label>
          <textarea id="on-behalf-note" rows={3} value={note} onChange={e => onChange({ reasonCode, note: e.target.value })}
            placeholder={`Say what happened, e.g. ${employeeName.split(' ')[0]} called on 10/1 asking me to enter this because they can't log in.`}
            className="px-3 py-2.5 border border-amber-300 rounded-lg text-[13px] bg-white focus:outline-none focus:border-amber-500 resize-none" />
          <p className={`text-[11px] ${touched && problem ? 'text-red-600' : 'text-amber-800'}`}>
            {touched && problem ? problem : `Required — at least ${ON_BEHALF_NOTE_MIN_LENGTH} characters. Approvers and the employee can see this.`}
          </p>
        </div>
      </div>
    </div>
  )
}
