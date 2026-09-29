-- CHA Employee Portal — Migration 034: signature snapshots on leave request events
--
-- The employee's "click to sign" on the request form and the manager's "Confirm & Sign" on approval/denial are now stored
-- on the audit event itself: the name that was signed, the employee number, the exact attestation wording agreed to, and
-- the IP address it came from. A signature is a snapshot — it stays exactly as signed even if a name or record changes.
--
-- Existing events are backfilled: the signer's name and number as of today, the attestation wording that was on screen
-- at the time, and no IP (never captured). `append-only` stays in force — the trigger is only paused for this backfill.
--
-- Apply via `supabase db push` (CLI) or the Management API, not the browser SQL editor.

alter table leave_request_events add column if not exists signature_name text;
alter table leave_request_events add column if not exists signer_employee_number integer;
alter table leave_request_events add column if not exists attestation text;
alter table leave_request_events add column if not exists signed_ip text;

alter table leave_request_events disable trigger leave_request_events_no_update;

update leave_request_events ev
set signature_name = ev.actor_name,
    signer_employee_number = e.employee_number,
    attestation = case ev.action
      when 'submitted' then 'By signing, you confirm this request is accurate and that leave requires approval before it is taken.'
      when 'approved' then 'By confirming, you approve this request — its balance will be deducted and the requested day(s) will be logged as Leave on their timesheet automatically.'
      when 'denied' then 'I have reviewed this request and deny it for the reason given.'
    end
from employees e
where e.id = ev.actor_id
  and ev.action in ('submitted', 'approved', 'denied')
  and ev.signature_name is null;

alter table leave_request_events enable trigger leave_request_events_no_update;
