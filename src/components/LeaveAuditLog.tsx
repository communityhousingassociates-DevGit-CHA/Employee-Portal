import type { LeaveEvent, LeaveEventAction } from '@/types'

const ACTION_LABEL: Record<LeaveEventAction, string> = {
  submitted: 'Submitted',
  submitted_on_behalf: 'Submitted on the employee’s behalf (exception)',
  auto_approved: 'Auto-approved',
  approved: 'Reviewed — Approved',
  denied: 'Reviewed — Denied',
  cancelled: 'Cancelled',
}

const ACTION_COLOR: Record<LeaveEventAction, string> = {
  submitted: 'border-[#d4eef2]',
  submitted_on_behalf: 'border-amber-400',
  auto_approved: 'border-emerald-300',
  approved: 'border-emerald-400',
  denied: 'border-red-400',
  cancelled: 'border-gray-300',
}

const ROLE_LABEL: Record<string, string> = { accounting_manager: 'Accounting Manager', ceo: 'CEO', admin: 'Admin' }

function stamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Read-only audit trail for one leave request: who did what, when, and why. */
export default function LeaveAuditLog({ events }: { events: LeaveEvent[] }) {
  if (events.length === 0) return <p className="text-[12px] text-gray-400">No history recorded yet.</p>
  return (
    <ul className="space-y-2">
      {events.map(e => (
        <li key={e.id} className={`text-[12px] border-l-2 pl-3 ${ACTION_COLOR[e.action]}`}>
          <p className="font-semibold text-[#0b2b35]">
            {ACTION_LABEL[e.action]}
            <span className="font-normal text-gray-400">
              {' '}· {e.action === 'cancelled' && e.backfilled ? 'time not recorded' : stamp(e.created_at)}
              {e.action !== 'auto_approved' && e.actor_name ? ` · ${e.actor_name}${e.actor_role && ROLE_LABEL[e.actor_role] && (e.action === 'approved' || e.action === 'denied') ? ` (${ROLE_LABEL[e.actor_role]})` : ''}` : ''}
            </span>
          </p>
          {e.note && <p className="text-gray-500 mt-0.5 whitespace-pre-line">{e.note}</p>}
        </li>
      ))}
    </ul>
  )
}
