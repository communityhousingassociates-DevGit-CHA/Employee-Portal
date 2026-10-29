-- Defense in depth: the portal reads data only from server code using the service-role key, never from the browser, so the
-- anon/authenticated roles need no table access at all. Row-level security already limited what they could see; this removes the
-- permission itself, so a future mistake in a row rule can't expose data to a signed-in user holding the public anon key.
-- (RLS helper functions current_employee_id()/current_employee_role() are SECURITY DEFINER and unaffected. Auth and storage
-- schemas are untouched, so sign-in and signed-URL uploads/downloads keep working.)
revoke select on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke select on tables from anon, authenticated;
-- Leftover non-data privileges (they grant no read or write, but there is no reason for the browser roles to hold them).
revoke references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke references, trigger on tables from anon, authenticated;
