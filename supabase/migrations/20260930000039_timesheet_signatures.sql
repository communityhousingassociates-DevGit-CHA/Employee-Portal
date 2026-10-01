-- CHA Employee Portal — Migration 039: store the signature wording verbatim on timesheet events
--
-- When a timesheet is submitted, the event now records the name signed, the signer's employee number, the exact attestation
-- wording that was on screen, and the IP address — the same snapshot leave requests keep (migration 034). Existing submit
-- events are backfilled with the wording that was shown at the time and no IP (never captured).
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table timesheet_events add column if not exists signature_name text;
alter table timesheet_events add column if not exists signer_employee_number integer;
alter table timesheet_events add column if not exists attestation text;
alter table timesheet_events add column if not exists signed_ip text;

update timesheet_events ev
set signature_name = a.name,
    signer_employee_number = a.employee_number,
    attestation = case ev.action
      when 'submitted' then 'By signing, I certify that the hours above are accurate and complete. This timesheet will be sent for approval.'
      when 'submitted_on_behalf' then 'I am completing this on behalf of ' || e.name || ' as an exception to the employee submitting it directly. I have recorded the reason, and I confirm the information is accurate to the best of my knowledge. The employee has not signed this entry themselves. This timesheet will be sent for approval.'
    end
from employees a, timesheets t, employees e
where a.id = ev.actor_id and t.id = ev.timesheet_id and e.id = t.employee_id
  and ev.action in ('submitted', 'submitted_on_behalf')
  and ev.attestation is null;
