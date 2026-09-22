-- CHA Employee Portal — Migration 014: optional attachment on leave requests
-- Required for Jury Duty (the summons), optional for every other leave type —
-- enforced server-side in createLeaveRequest(), not just in the form.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.

alter table leave_requests add column if not exists attachment_url text; -- path in the private 'leave-attachments' bucket

insert into storage.buckets (id, name, public)
values ('leave-attachments', 'leave-attachments', false)
on conflict (id) do nothing;
