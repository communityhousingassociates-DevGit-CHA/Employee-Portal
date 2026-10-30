-- Split employees.name into first_name / last_name / middle_initial for payroll accuracy.
-- name becomes a generated column so every existing SELECT/join keeps working unchanged.

alter table employees add column first_name text;
alter table employees add column last_name text;
alter table employees add column middle_initial text;

update employees set
  first_name = coalesce(nullif(split_part(name, ' ', 1), ''), name),
  last_name = case
    when position(' ' in name) > 0 then trim(substring(name from position(' ' in name) + 1))
    else ''
  end
where first_name is null;

alter table employees alter column first_name set not null;
alter table employees alter column last_name set not null;

alter table employees drop column name;

alter table employees add column name text generated always as (
  trim(both ' ' from
    first_name
    || coalesce(' ' || nullif(middle_initial, '') || '.', '')
    || ' ' || last_name
  )
) stored;
