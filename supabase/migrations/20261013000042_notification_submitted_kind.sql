-- Adds the 'submitted' notification kind: confirmation sent to an employee when they submit their own timesheet.
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('approval_needed', 'approved', 'denied', 'returned', 'cancelled', 'on_behalf', 'submitted'));
