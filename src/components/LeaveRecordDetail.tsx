import type { LeaveEvent } from '@/types'
import LeaveAuditLog from '@/components/LeaveAuditLog'
import { onBehalfReasonLabel } from '@/lib/constants/on-behalf'

const ROLE_LABEL: Record<string, string> = { accounting_manager: 'Accounting Manager', ceo: 'CEO', admin: 'Admin' }

function stamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

function SignatureBlock({ title, tone, event, empty }: { title: string; tone: 'neutral' | 'approved' | 'denied' | 'exception'; event: LeaveEvent | undefined; empty: string }) {
  const border = tone === 'exception' ? 'border-amber-300 bg-amber-50/60' : tone === 'approved' ? 'border-emerald-200 bg-emerald-50/50' : tone === 'denied' ? 'border-red-200 bg-red-50/50' : 'border-[#d4eef2] bg-white'
  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">{title}</p>
      {!event || !event.signature_name ? (
        <p className="text-[12px] text-gray-400">{empty}</p>
      ) : (
        <>
          <p className="font-[cursive] text-[24px] leading-tight text-[#0b2b35] border-b border-gray-300 pb-1">{event.signature_name}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">
            {event.signature_name}
            {event.signer_employee_number != null && <> · Employee ID {event.signer_employee_number}</>}
            {event.actor_role && ROLE_LABEL[event.actor_role] && event.action !== 'submitted' && <> · {ROLE_LABEL[event.actor_role]}</>}
          </p>
          <p className="text-[11px] text-gray-500">Signed {stamp(event.created_at)}</p>
          {event.attestation && <p className="text-[11px] text-gray-400 italic mt-2">&ldquo;{event.attestation}&rdquo;</p>}
          {event.note && event.action === 'denied' && <p className="text-[12px] text-red-600 mt-2">Reason: {event.note}</p>}
          {event.action === 'submitted_on_behalf' && (
            <p className="text-[12px] text-amber-800 mt-2"><strong>Reason:</strong> {onBehalfReasonLabel(event.reason_code)}{event.note ? <><br /><strong>Notes:</strong> {event.note}</> : null}</p>
          )}
        </>
      )}
    </div>
  )
}

/** The full record of one leave request: the employee's signature, the reviewing manager's signature, and the history. */
export default function LeaveRecordDetail({ events }: { events: LeaveEvent[] }) {
  const submitted = events.find(e => e.action === 'submitted' || e.action === 'submitted_on_behalf')
  const decision = [...events].reverse().find(e => e.action === 'approved' || e.action === 'denied')
  const auto = events.find(e => e.action === 'auto_approved')
  const cancelled = events.find(e => e.action === 'cancelled')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SignatureBlock
          title={submitted?.action === 'submitted_on_behalf' ? 'Exception — completed on the employee’s behalf (administrator signature)' : 'Requested by — employee signature'}
          tone={submitted?.action === 'submitted_on_behalf' ? 'exception' : 'neutral'}
          event={submitted}
          empty="No signature on file for this request."
        />
        {cancelled && !decision && !auto ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Review</p>
            <p className="text-[13px] font-semibold text-gray-600">Not reviewed — cancelled by the employee</p>
            <p className="text-[11px] text-gray-500 mt-1">{cancelled.backfilled ? 'Time not recorded' : stamp(cancelled.created_at)}</p>
          </div>
        ) : auto && !decision ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Approval</p>
            <p className="text-[13px] font-semibold text-emerald-700">Auto-approved by the system</p>
            <p className="text-[11px] text-gray-500 mt-1">{stamp(auto.created_at)}</p>
            <p className="text-[11px] text-gray-400 italic mt-2">&ldquo;The employee&rsquo;s balance covered the request, so no manager review was required.&rdquo;</p>
          </div>
        ) : (
          <SignatureBlock
            title={decision?.action === 'denied' ? 'Reviewed by — denial signature' : 'Reviewed by — approval signature'}
            tone={decision?.action === 'denied' ? 'denied' : decision ? 'approved' : 'neutral'}
            event={decision}
            empty="Awaiting manager review."
          />
        )}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">History</p>
        <LeaveAuditLog events={events} />
      </div>
    </div>
  )
}
