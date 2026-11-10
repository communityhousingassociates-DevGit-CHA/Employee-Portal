-- Friendly tracking number for issue reports / beta feedback, shown as PORTAL-0001 etc. Existing rows are numbered too.
ALTER TABLE issue_reports ADD COLUMN IF NOT EXISTS ticket_no bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX IF NOT EXISTS issue_reports_ticket_no_key ON issue_reports (ticket_no);
