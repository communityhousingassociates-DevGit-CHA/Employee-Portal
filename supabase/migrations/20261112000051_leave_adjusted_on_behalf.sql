-- An administrator (Nico, Carrileen, super admin) can correct the hours on an existing leave request instead of cancelling and
-- re-entering it. Every adjustment is one 'adjusted_on_behalf' event carrying the reason code, notes and the before/after hours.
alter table leave_request_events drop constraint if exists leave_request_events_action_check;
alter table leave_request_events add constraint leave_request_events_action_check
  check (action in ('submitted', 'submitted_on_behalf', 'adjusted_on_behalf', 'auto_approved', 'approved', 'denied', 'cancelled'));
