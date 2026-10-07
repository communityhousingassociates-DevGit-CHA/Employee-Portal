-- CHA Employee Portal — Migration 020: funding pipeline (private grant prospecting for PSH)
-- Admin Console > Executive Funding. Visible ONLY to the super admin while testing (enforced in the app by canAccessFunding).
-- Not related to the `grants` table, which holds timesheet grant tags.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor.
-- Seed rows come from research done 2026-10-03; confirm each funder's current guidelines before outreach.

create table if not exists funding_pipeline (
  id uuid primary key default gen_random_uuid(),
  funder text not null,
  funder_type text,
  fit_notes text,
  ask_size_published text,
  process_notes text,
  eligibility_notes text,
  priority text not null default 'B' check (priority in ('A','B','C')),
  stage text not null default 'research' check (stage in
    ('research','intro_call','loi_drafted','loi_submitted','invited_to_apply','proposal_submitted','awarded','declined','reporting','skipped')),
  ask_amount numeric,
  probability integer check (probability between 0 and 100),
  purpose text,
  owner text,
  next_step text,
  next_step_due date,
  loi_sent_on date,
  proposal_due date,
  decision_date date,
  awarded_amount numeric,
  source_url text,
  verification text,
  created_by uuid references employees(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists funding_activity (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references funding_pipeline(id) on delete cascade not null,
  note text not null,
  author_id uuid references employees(id),
  created_at timestamptz default now()
);
create index if not exists funding_activity_pipeline_idx on funding_activity (pipeline_id, created_at desc);

alter table funding_pipeline enable row level security;
alter table funding_activity enable row level security;
-- No policies on purpose: with RLS on and no policy, direct (anon/authenticated) access is denied. The portal reads and writes
-- these tables only through server actions that use the service role after the super-admin check.

insert into funding_pipeline
  (funder, funder_type, fit_notes, ask_size_published, process_notes, eligibility_notes, priority, next_step, source_url, verification, stage)
values
  ('Baltimore Community Foundation + Weinberg Foundation (Baltimore City Community Grants)', 'Community foundation / private foundation', 'Housing focus explicitly names housing for chronically homeless people with disabilities and PSH. Small unrestricted or project grant.', '~$20,000 one-time', '2026 window (Jun 1 - Sep 30) is CLOSED. Next window date not published; contact grants@bcf.org / (410) 332-4171. An aggregator listed Oct 15, 2026 for a capital variant - BCF''s own page does not confirm it.', 'Total org budget <= $500K. CHA''s FY2024 expenses were $1.90M (990), so CHA does NOT meet this cap. Also: 3+ yrs, audit, >= 50% of capital cost raised, no open Weinberg grant.', 'C', 'None unless BCF confirms the cap applies to a program budget rather than whole-org budget (one email to grants@bcf.org settles it).', 'https://www.bcf.org/grants/', 'Closed status confirmed; cap confirmed on BCF page; CHA ineligible per 990', 'skipped'),
  ('Harry and Jeanette Weinberg Foundation (Baltimore)', 'Private foundation', '~25% of ~$140M annual giving goes to Greater Baltimore; Housing is a named priority incl. $8M deeply affordable housing for people with disabilities.', 'Not published', 'Application path (open vs invitation) not stated on public page. Call 410-654-8500 and ask for the housing program officer.', 'Cannot overlap with BCF small-grant program if already a Weinberg grantee.', 'A', 'Meet Amy Kleine (Senior Program Director, Housing) at the CSH Forum Oct 12-13 (she speaks at the opening plenary and the Catalyzing Development breakout); follow up by phone/email afterward to ask about application path.', 'https://hjweinbergfoundation.org/grants/where-we-give/', 'Priority confirmed; process NOT verified', 'research'),
  ('Abell Foundation', 'Private foundation', 'Community Development and Health & Human Services priorities; funds seed pilots, ongoing programs, and capital projects in Baltimore City.', 'Small: <= $10,000 (rolling). Regular: > $10,000 (5 Board meetings/yr)', 'First-time applicants: info session (small) or short LOI (> $10,000), then full application.', 'Baltimore City focus.', 'A', 'Register for info session or send LOI for a services-funding ask.', 'https://abell.org/grants/', 'Verified', 'research'),
  ('France-Merrick Foundation', 'Private foundation', 'Health & human services grants name housing; also short-term support to protect progress in housing and health.', '> $50,000 requires LOI then full proposal; smaller requests have a separate path', 'Over-$50K requests reviewed quarterly. LOI accepted anytime per aggregators; 2026 dates unverified (their site did not load).', 'Baltimore focus.', 'A', 'Verify guidelines at france-merrickfdn.org and send LOI for a multi-year services ask.', 'https://www.france-merrickfdn.org/', 'NOT verified directly', 'research'),
  ('Goldseker Foundation', 'Private foundation', 'Neighborhood revitalization/community development; has funded Baltimore housing nonprofits (NHS, CHAI, Parity Homes). Closer fit for capital/neighborhood angle than for services.', '$5.6M+ total granted in 2025', '''How to Apply'' section on site; details not retrieved.', 'Strategy-driven; PSH-specific fit unclear.', 'B', 'Read How to Apply page; call (410) 837-5100 to test fit.', 'https://goldsekerfoundation.org/', 'Partly verified', 'research'),
  ('Corporation for Supportive Housing (CSH) - Baltimore Supportive Housing Institute', 'Intermediary + public/philanthropic', 'Training and technical assistance for PSH development teams; participating teams can receive up to $150,000 predevelopment funding via the City''s Housing Accelerator Fund (2024 cycle terms).', 'Up to $150,000 predevelopment', 'Run in cycles with City DHCD, MOHS, HAND. 2026+ cycle not confirmed. CSH Maryland Supportive Housing Summit Oct 12-13 (Baltimore) - good networking.', 'Needs a development team and site/concept.', 'A', 'Attend the CSH Forum Oct 12-13 and meet Jillian Fox (Director, Mid-Atlantic) and Maya Saxena (Senior Program Manager) to ask about the next Supportive Housing Institute cycle.', 'https://www.csh.org/', '2024 RFA terms only', 'research'),
  ('Hospital system partnership (ACIS: Johns Hopkins, UMMS, MedStar, LifeBridge, Mercy, Ascension Saint Agnes)', 'Health system community benefit (pooled w/ City/State)', 'Hospital-funded supportive housing slots through Assistance in Community Integration Services (ACIS) with Medicaid match; 94% stably housed at 2 years in pilot.', 'Per-slot service funding via City RFP', 'City ''FY 2027 ACIS Expansion RFP'' listed (deadline extended 8/12/2026) - check if still open and who is eligible.', 'Must be a provider able to deliver the ACIS service model.', 'A', 'Review ACIS expansion RFP and the Medicaid supportive housing services waiver. At the Forum, meet Ernestina Simmons (Executive Director, Mayor''s Office of Homeless Services) and Priya Arokiaswamy (Maryland Behavioral Health Administration).', 'https://www.baltimorecity.gov/homeless/resources-for-service-providers/grant-opportunities', 'Verified via City page', 'research'),
  ('Annie E. Casey Foundation', 'Private foundation', 'Baltimore-based; active in affordable housing and renter wealth locally. Mostly systems/strategy and invitation-driven.', 'Not published', 'Largely invitation-based - relationship-led.', 'Family/child focus may be a fit if CHA serves families.', 'C', 'Identify Baltimore program staff contact; seek introduction via peer grantee.', 'https://www.aecf.org/', 'Priority loosely verified', 'research'),
  ('Hoffberger Family Philanthropies', 'Family foundation', 'Priorities: workforce/economic mobility and children''s mental health & trauma. Weak direct PSH fit.', 'Not published', 'Has a published grant process.', 'Frame only if CHA has a workforce or youth-trauma component.', 'C', 'Review Grant Process page before deciding.', 'https://www.hoffberger.org/grant-process/', 'Partly verified', 'research'),
  ('Conrad N. Hilton Foundation (national)', 'Private foundation', 'Funds chronic homelessness / supportive housing intermediaries including Enterprise. Typically large/system-level; CHA more likely to benefit via intermediaries.', 'Large, multi-year', 'Invitation-based.', 'Not a direct-ask for a single local provider.', 'C', 'Track via Enterprise/CSH rather than approach directly.', 'https://www.hiltonfoundation.org/', 'Existence confirmed; guidelines not reviewed', 'research');
