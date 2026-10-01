import type { ExpenseEvent, ExpenseEventAction } from '@/types'
import { onBehalfReasonLabel } from '@/lib/constants/on-behalf'

const ACTION_LABEL: Record<ExpenseEventAction, string> = {
  submitted: 'Submitted',
  submitted_on_behalf: 'Entered on the employee’s behalf (exception)',
  approved: 'Reviewed — Approved',
  denied: 'Reviewed — Denied',
}

const ACTION_COLOR: Record<ExpenseEventAction, string> = {
  submitted: 'border-[#d4eef2]',
  submitted_on_behalf: 'border-amber-400',
  approved: 'border-emerald-400',
  denied: 'border-red-400',
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Read-only audit trail for one expense: who did what, when, and why. */
export default function ExpenseAuditLog({ events }: { events: ExpenseEvent[] }) {
  if (events.length === 0) return <p className="text-[12px] text-gray-400">No history recorded yet.</p>
  return (
    <ul className="space-y-2">
      {events.map(e => (
        <li key={e.id} className={`text-[12px] border-l-2 pl-3 ${ACTION_COLOR[e.action]}`}>
          <p className="font-semibold text-[#0b2b35]">
            {ACTION_LABEL[e.action]}
            <span className="font-normal text-gray-400"> · {stamp(e.created_at)}{e.actor_name ? ` · ${e.actor_name}` : ''}</span>
          </p>
          {e.action === 'submitted_on_behalf' && e.reason_code && <p className="text-amber-800 mt-0.5"><strong>Reason:</strong> {onBehalfReasonLabel(e.reason_code)}</p>}
          {e.note && <p className="text-gray-500 mt-0.5 whitespace-pre-line">{e.action === 'submitted_on_behalf' ? <><strong>Notes:</strong> {e.note}</> : e.note}</p>}
        </li>
      ))}
    </ul>
  )
}
