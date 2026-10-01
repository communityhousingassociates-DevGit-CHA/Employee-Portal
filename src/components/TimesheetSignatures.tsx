import type { Timesheet, TimesheetAudit, TimesheetEventAction } from '@/types'
import { onBehalfReasonLabel } from '@/lib/constants/on-behalf'
import { TIMESHEET_ATTESTATION, timesheetOnBehalfAttestation } from '@/lib/constants/timesheet-signature'
import { reopenReasonLabel } from '@/lib/constants/timesheet-reopen'

const ROLE_LABEL: Record<string, string> = { accounting_manager: 'Accounting Manager', ceo: 'President / CEO', admin: 'Administrator' }

const EVENT_LABELS: Record<TimesheetEventAction, string> = {
  submitted: 'Submitted',
  submitted_on_behalf: 'Submitted on the employee’s behalf (exception)',
  edited_on_behalf: 'Edited on the employee’s behalf (exception)',
  approved: 'Approved',
  returned: 'Returned for correction',
  reopened: 'Reopened',
  override_reopened: 'Reopened — CEO override',
  correction_requested: 'Correction requested by employee',
  leave_reopened: 'Reopened — leave added',
  leave_held: 'Leave held — period closed',
  tags_changed: 'Tags adjusted',
}

const EVENT_COLOR: Partial<Record<TimesheetEventAction, string>> = {
  submitted_on_behalf: 'border-amber-400',
  edited_on_behalf: 'border-amber-300',
  approved: 'border-emerald-400',
  returned: 'border-red-300',
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

/**
 * Under a submitted or approved timesheet: who signed it, who approved it, and the full history. The timesheet itself stays
 * visible above, so this is the record of what was submitted and by whom. A timesheet an administrator completed for the
 * employee is shown as that exception, with the reason and notes.
 */
export default function TimesheetSignatures({
  timesheet,
  audit,
  employeeName,
  employeeIdLabel,
}: {
  timesheet: Timesheet
  audit: TimesheetAudit
  employeeName: string
  employeeIdLabel: string
}) {
  const onBehalf = !!audit.submitted_by_name
  // The wording exactly as it was signed (stored on the submit event); the current wording only for anything signed before it was kept.
  const signedEvent = [...audit.events].reverse().find(e => e.action === 'submitted' || e.action === 'submitted_on_behalf')
  const attestation = signedEvent?.attestation ?? (onBehalf ? timesheetOnBehalfAttestation(employeeName) : TIMESHEET_ATTESTATION)
  const approved = timesheet.status === 'approved' && !!audit.approver_name
  return (
    <section aria-label="Signatures and audit trail" className="mt-6 bg-white border border-[#d4eef2] rounded-xl p-4 sm:p-6 max-w-4xl">
      <p className="text-[14px] font-bold text-[#0b2b35] mb-0.5">Signatures &amp; audit trail</p>
      <p className="text-[12px] text-gray-400 mb-4">The record of who submitted this timesheet and who approved it.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 ${onBehalf ? 'border-amber-300 bg-amber-50/60' : 'border-[#d4eef2] bg-white'}`}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
            {onBehalf ? 'Exception — completed on the employee’s behalf (administrator signature)' : 'Employee certification & signature'}
          </p>
          {timesheet.employee_signed_at ? (
            <>
              <p className="font-[cursive] text-[24px] leading-tight text-[#0b2b35] border-b border-gray-300 pb-1">{onBehalf ? audit.submitted_by_name : employeeName}</p>
              <p className="text-[11px] text-gray-500 mt-1.5">
                {onBehalf
                  ? <>{audit.submitted_by_name}{audit.submitted_by_role && ROLE_LABEL[audit.submitted_by_role] ? ` (${ROLE_LABEL[audit.submitted_by_role]})` : ''} on behalf of {employeeName} · Employee ID {employeeIdLabel}</>
                  : <>{employeeName} · Employee ID {employeeIdLabel}</>}
              </p>
              <p className="text-[11px] text-gray-500">Signed {stamp(timesheet.employee_signed_at)}</p>
              <p className="text-[11px] text-gray-400 italic mt-2">
                &ldquo;{attestation}&rdquo;
              </p>
              {onBehalf && (
                <p className="text-[12px] text-amber-800 mt-2">
                  <strong>Reason:</strong> {onBehalfReasonLabel(timesheet.on_behalf_reason_code)}
                  {timesheet.on_behalf_note ? <><br /><strong>Notes:</strong> {timesheet.on_behalf_note}</> : null}
                </p>
              )}
            </>
          ) : (
            <p className="text-[12px] text-gray-400">No signature on file.</p>
          )}
        </div>

        <div className={`rounded-xl border p-4 ${approved ? 'border-emerald-200 bg-emerald-50/50' : 'border-[#d4eef2] bg-white'}`}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Reviewed by — approval signature</p>
          {approved ? (
            <>
              <p className="font-[cursive] text-[24px] leading-tight text-[#0b2b35] border-b border-gray-300 pb-1">{audit.approver_name}</p>
              <p className="text-[11px] text-gray-500 mt-1.5">{audit.approver_name}{audit.approver_role && ROLE_LABEL[audit.approver_role] ? ` · ${ROLE_LABEL[audit.approver_role]}` : ''}</p>
              {timesheet.approved_at && <p className="text-[11px] text-gray-500">Approved {stamp(timesheet.approved_at)}</p>}
            </>
          ) : (
            <p className="text-[12px] text-gray-500">Awaiting manager review. The approver&rsquo;s signature will appear here once it&rsquo;s approved.</p>
          )}
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mt-5 mb-2">History</p>
      {audit.events.length === 0 ? (
        <p className="text-[12px] text-gray-400">No history recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {audit.events.map(e => (
            <li key={e.id} className={`text-[12px] border-l-2 pl-3 ${EVENT_COLOR[e.action] ?? 'border-[#d4eef2]'}`}>
              <p className="font-semibold text-[#0b2b35]">
                {EVENT_LABELS[e.action] ?? e.action}
                <span className="font-normal text-gray-400"> · {stamp(e.created_at)}{e.actor_name ? ` · ${e.actor_name}` : ''}</span>
              </p>
              {(e.reason_code || e.note) && (
                <p className="text-gray-500 mt-0.5 whitespace-pre-line">
                  {e.reason_code ? `${e.action.endsWith('_on_behalf') ? onBehalfReasonLabel(e.reason_code) : reopenReasonLabel(e.reason_code)}${e.note ? ' — ' : ''}` : ''}{e.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
