-- CHA Employee Portal — Migration 022: AI funder search review queue
-- The Executive Funding "Suggested" tab runs a web-search agent (Claude) that proposes funders. Proposals land here for human review;
-- nothing reaches funding_pipeline until a super admin clicks Add. Dismissed rows are kept so the same funder is not suggested again.
-- Same access model as 020/021: RLS on, no policies, service role only. Apply via the Management API, not the browser SQL editor.

create table if not exists funding_search_runs (
  id uuid primary key default gen_random_uuid(),
  focus text,
  started_by uuid references employees(id),
  created_at timestamptz default now(),
  candidates integer not null default 0,
  input_tokens integer,
  output_tokens integer,
  searches integer,
  error text
);
create index if not exists funding_search_runs_created_idx on funding_search_runs (created_at desc);

create table if not exists funding_suggestions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references funding_search_runs(id) on delete set null,
  funder text not null,
  funder_key text not null,
  funder_type text,
  geography text not null default 'national' check (geography in ('baltimore','maryland','regional','federal','national')),
  priority text not null default 'C' check (priority in ('A','B','C')),
  fit_notes text,
  ask_size_published text,
  process_notes text,
  eligibility_notes text,
  next_step text,
  next_step_due date,
  source_url text,
  verification text,
  status text not null default 'new' check (status in ('new','added','dismissed')),
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
create unique index if not exists funding_suggestions_key_idx on funding_suggestions (funder_key);
create index if not exists funding_suggestions_status_idx on funding_suggestions (status, created_at desc);

alter table funding_search_runs enable row level security;
alter table funding_suggestions enable row level security;
