-- CHA Employee Portal — Migration 021: Executive Funding expansion
-- 1) funding_pipeline gets geography + relationship so the pipeline can go beyond Greater Baltimore and separate funders CHA already knows.
-- 2) New funder prospects researched 2026-10-08 (regional, state, federal, national). Every row carries a verification note; confirm with the funder before outreach.
-- 3) grants_profile: reusable organization facts and boilerplate for applications. Values marked draft come from the FY2024 Form 990 and the 2026-10-03 research; confirm before use.
-- Apply via the Management API or `supabase db push`, not the browser SQL editor. Same access model as 020: RLS on, no policies, service role only.

alter table funding_pipeline add column if not exists geography text not null default 'baltimore'
  check (geography in ('baltimore','maryland','regional','federal','national'));
alter table funding_pipeline add column if not exists relationship text not null default 'none'
  check (relationship in ('existing','warm','none'));

-- Funders seeded in 020 that are not Baltimore-only.
update funding_pipeline set geography = 'national' where funder like 'Conrad N. Hilton Foundation%';

insert into funding_pipeline
  (funder, funder_type, geography, priority, stage, fit_notes, ask_size_published, process_notes, eligibility_notes, next_step, next_step_due, source_url, verification)
values
  ('M&T Charitable Foundation', 'Bank foundation', 'regional', 'A', 'research',
   'Supports civic, cultural, health and human service organizations where M&T does business, which includes Baltimore. Funds ongoing, long-term programs, so frame the ask as a program (for example resident services in PSH), not general operating.',
   'Not published',
   'Online application only; email and mail requests are not accepted. The 2026 portal closes Friday 2026-10-30 at 11:59 pm ET. M&T asks for at least 8 weeks before a decision is needed, so a 2026 decision is unlikely; applying still starts the relationship. The 2027 window has not been announced. Regional contacts are listed on the M&T Charitable Contacts page for Maryland, Virginia and Greater Washington.',
   'Program support only. Housing is not named on the main page, so confirm fit with the regional contact. Requests of $10,000 or more reportedly need the Form 990, audited financials and the annual operating budget, plus the IRS determination letter and board list.',
   'Call the Maryland regional contact to confirm fit, then submit before the portal closes.', '2026-10-30',
   'https://www.mtb.com/about-mt/charitable-contributions',
   'Deadline and process read on mtb.com 2026-10-08. Eligibility details and document list come from a search summary and were not read on the program page.'),

  ('Maryland Community Investment Tax Credit (DHCD)', 'State tax credit program', 'maryland', 'A', 'research',
   'Lets CHA offer donors a Maryland tax credit on gifts to an approved project. Directly useful for a first-time private fundraising effort (private gifts were $3,471 in FY2024). Eligible categories include Housing and Community Development and Services for At-Risk Populations.',
   'Up to $100,000 in tax credits per organization',
   'Annual competitive round. The FY2027 round ran 2026-06-02 to 2026-07-14 and is closed. FY2028 timing is not announced; the last two rounds opened in late spring, so plan for roughly May-June 2027. Organizations must register in the DHCD Project Portal first (registration can take up to 72 hours). A secondary source says donors giving $500 or more receive a credit equal to 50 percent of the gift; confirm in the Policy and Application Guide.',
   '501(c)(3). The project must be located in or serve residents of a Priority Funding Area. Confirm that the Baltimore City properties qualify.',
   'Register in the DHCD Project Portal now and read the FY2027 Policy and Application Guide to prepare for the next round.', null,
   'https://dhcd.maryland.gov/communities/pages/programs/citc.aspx',
   'Program page read on dhcd.maryland.gov 2026-10-08 (dates, cap, eligibility, categories). The 50 percent donor credit rate is from a search summary, not the page.'),

  ('CareFirst BlueCross BlueShield (community impact)', 'Health insurer giving', 'regional', 'B', 'research',
   'Behavioral health is a stated priority. CareFirst put nearly $8 million into behavioral health grants and investments (2022-2025) across Maryland, DC and Northern Virginia, mostly youth and provider capacity. Also runs Huddle Up for Health with the Baltimore Ravens (up to $50,000). No housing-specific program found.',
   'Huddle Up for Health: up to $50,000',
   'The behavioral health initiative was a selected cohort, not an open call. The last Huddle Up for Health window found (2024) closed 2024-05-17; look for a newer round. General eligibility: 501(c)(3), operates in the CareFirst service area (Maryland, DC, Northern Virginia), shows fiscal and administrative stability.',
   'Fiscal stability is a stated criterion; CHA thin cash position will draw questions. Frame as social determinants of health (housing stability for adults with psychiatric disabilities).',
   'Email the Community Health and Social Impact team to ask whether a housing-linked behavioral health project fits and when the next Huddle Up round opens.', null,
   'https://individual.carefirst.com/individuals-families/transformation/community-impact.page',
   'Search summaries plus community impact page read 2026-10-08. No current open call confirmed.'),

  ('Bank of America Charitable Foundation (Neighborhood Builders)', 'Bank foundation', 'national', 'B', 'research',
   'Neighborhood Builders names stable housing as a funding area and pairs the grant with leadership training. Awards are large relative to CHA budget.',
   '$100,000-$400,000 over two years (cannot exceed 10 percent of annual revenue, about $197K for CHA at FY2024 revenue)',
   '2026 cycle is closed; the next cycle opens spring 2027. The separate Stable Housing and Empowering Communities RFP window (2026-05-18 to 2026-06-29) is also closed.',
   'Requires two filed fiscal years, financial soundness, a 3-year plan, and an executive director plus an emerging leader each in role at least 2 years. Must serve a listed market; Baltimore not yet confirmed. Cash of $12K and an unrestricted deficit may be questioned under financially sound.',
   'Confirm Baltimore is a listed market and identify the emerging leader candidate. Calendar the spring 2027 window.', null,
   'https://about.bankofamerica.com/en/making-an-impact/neighborhood-builders-eligibility-criteria',
   'Eligibility summary from the bankofamerica.com page via search 2026-10-08; page not read in full.'),

  ('UnitedHealthcare Community Plan of Maryland (Empowering Health)', 'Managed care plan giving', 'maryland', 'B', 'research',
   'Has funded Maryland nonprofits for food insecurity, social isolation and behavioral health ($1M in 2020, $500K in 2022) and gave $50,000 to Health Care for the Homeless in Baltimore to connect people to housing and services.',
   'Past grants roughly $50,000-$125,000',
   'No 2025 or 2026 Maryland grant round found. Ask the plan community affairs team about current community reinvestment funding and whether CHA residents are plan members (a shared-data angle worked for Health Care for the Homeless).',
   'Unconfirmed whether the program is still active.',
   'Ask UnitedHealthcare Community Plan Maryland community affairs whether a new Empowering Health round is planned.', null,
   'https://www.unitedhealthgroup.com/newsroom/2022/2022-08-10-uhc-maryland-empowering-health-donation.html',
   'Based on 2020-2022 press releases only. Treat as a lead, not an open program.'),

  ('Maryland Community Health Resources Commission (CHRC)', 'State commission', 'maryland', 'B', 'research',
   'Funds projects that expand health care access for vulnerable Marylanders. The FY2026 round awarded $7.5 million to 14 projects (announced 2026-07-16). A housing-plus-health or care-coordination framing might fit, but housing alone does not.',
   'Round total about $7 million',
   'FY2027 Request for Applications was released December 2025. A third-party site lists a December 9, 2026 deadline; this is unverified, check the CHRC site directly.',
   'Fit for a housing provider is unproven. Usually favors health access, behavioral health integration and safety-net capacity.',
   'Read the current CHRC request for applications and decide whether a resident health-services component makes CHA eligible.', null,
   'https://health.maryland.gov/mchrc/Pages/home.aspx',
   'Search summaries only. Deadline unverified.'),

  ('Maryland Behavioral Health Administration: Community Bond capital program', 'State capital grants', 'maryland', 'B', 'research',
   'The BHA FY2028 bond application packet (January 2026) says housing remains a priority for community bond projects serving the behavioral health population, including supported housing. Fits the capital and unit-upkeep bucket, not services.',
   'Not published in the sources found',
   'Capital grant application, not an open RFP. Details such as match requirements and whether a legislative sponsor is needed should be confirmed with BHA and MDH. Avoid leading with capital until the cash and deficit plan is clear.',
   'Match, readiness and property-control requirements not confirmed.',
   'Ask BHA when the next community bond application cycle opens and what project readiness it expects.', null,
   'https://health.maryland.gov/ocpbes/Documents/FY28%20Bond%20Application/Attachment%20E_BHA%20FY28.docx',
   'One state attachment found via search; not read in full. Unverified for CHA.'),

  ('HUD Section 811 Project Rental Assistance (via Maryland DHCD)', 'Federal rental subsidy (state-administered)', 'federal', 'B', 'research',
   'Project-based rental assistance for non-elderly adults with disabilities. A direct match for CHA population and a way to cover operating gaps on units. Nonprofit owners participate through Maryland DHCD, MDH and MDOD, typically on LIHTC-financed properties.',
   'Rental subsidy rather than a grant',
   'HUD FY2026 notice HSG-2600-DC-0053 was due 2026-07-13 (closed). Applicants to HUD are state agencies, so the route is asking DHCD whether CHA properties can be set aside under Maryland program.',
   'Property financing structure (LIHTC or not) determines eligibility. Maryland program documents found are old.',
   'Ask DHCD which CHA-related properties could qualify for 811 PRA units.', null,
   'https://dhcd.maryland.gov/HousingDevelopment/Pages/section811.aspx',
   'From search summaries; the DHCD program page was not read. Verify current Maryland program terms.'),

  ('SAMHSA Grants for the Benefit of Homeless Individuals (GBHI)', 'Federal grant', 'federal', 'C', 'research',
   'Services for people experiencing homelessness with serious mental illness, including case management, benefit enrollment and help reaching permanent housing. Awards can run up to 5 years.',
   'FY2023 notice: up to $15.7M total across awards',
   'No FY2026 notice found. Monitor Grants.gov and SAMHSA. Requires SAM.gov and Grants.gov registration (UEI). A July 2025 executive order directs agencies away from Housing First, so check current priorities before investing time.',
   'Federal reporting and audit load is significant for an organization of 8 staff. Consider partnering with a larger lead applicant.',
   'Register CHA in SAM.gov and Grants.gov so CHA can respond fast; watch for a GBHI notice.', null,
   'https://www.samhsa.gov/communities/homelessness-programs-resources/grants/gbhi',
   'Search summaries; most recent notice found is FY2023.'),

  ('Wells Fargo and Enterprise: Housing Affordability Breakthrough Challenge', 'Corporate innovation challenge', 'national', 'C', 'research',
   'National challenge ($10 million across five organizations in 2026) for scalable housing solutions in design and construction, finance, or service and delivery programs. Better suited to an innovative model than to CHA core PSH operations.',
   '$10 million total across five awards (2026 cycle)',
   '2026 applications ran 2026-04-01 to 2026-05-15 (closed). Third cycle; a 2027 round is plausible but unannounced.',
   'Favors proven, ready-to-scale solutions with evidence. CHA outcomes data is not yet assembled.',
   'Watch Enterprise Community Partners for the next cycle.', null,
   'https://www.businesswire.com/news/home/20260318441239/en',
   'Press coverage and aggregator listing; official page not read.'),

  ('Elevance Health Foundation', 'Health insurer foundation', 'national', 'C', 'research',
   'Announced about $5.8 million in behavioral health grants in June 2026 to nonprofits improving access to mental health and substance use services. Local-program states listed do not include Maryland.',
   'Not confirmed',
   'Confirm whether Maryland organizations can apply to the national behavioral health grant stream and what the process is.',
   'Maryland is not on its list of local-program states in the guidelines found.',
   'Read the Elevance Health Foundation grant guidelines and check Maryland eligibility.', null,
   'https://pulse2.com/elevance-health-foundation-invests-5-8-million-to-expand-behavioral-health-access/',
   'News coverage and search summary; guidelines not read.'),

  ('PNC Foundation (affordable housing)', 'Bank foundation', 'regional', 'C', 'research',
   'Affordable housing is a PNC Foundation focus area (housing counseling, transitional housing, credit counseling). The page found lists eligible regions that do not include Baltimore, but the page looks dated.',
   'Not published',
   'Contact the PNC regional representative; applications run through the PNC online system (CyberGrants) for other programs.',
   'Activity must occur where PNC has a significant presence. Baltimore status unconfirmed.',
   'Ask PNC whether Baltimore City is an eligible community for the housing focus.', null,
   'https://www.pnc.com/en/about-pnc/corporate-responsibility/philanthropy/pnc-foundation.html',
   'Search summary only; page appears dated.'),

  ('Peg''s Foundation (mental health)', 'Private foundation', 'national', 'C', 'skipped',
   'Focused on serious mental illness, but grants are limited to Ohio.',
   'Not applicable',
   'Screened out 2026-10-08. Inquiry deadline noted as November 1 for Ohio applicants.',
   'Applicants must be located in and serve 18 Ohio counties.',
   null, null,
   'https://pegsfoundation.org/focus',
   'Geography confirmed via search summary of pegsfoundation.org.'),

  ('Morris and Gwendolyn Cafritz Foundation', 'Private foundation', 'regional', 'C', 'skipped',
   'Strong housing and supportive housing priority, but only for DC and Prince George''s and Montgomery Counties in Maryland.',
   'Typically $10,000-$50,000',
   'Screened out for geography 2026-10-08. Deadlines are March 1, July 1 and November 1. Revisit only if CHA starts serving those counties.',
   'Must serve DC, Prince George''s or Montgomery County. Does not fund capital campaigns or multi-year grants.',
   null, null,
   'https://www.cafritzfoundation.org/',
   'Geography confirmed via search summary of the foundation site.'),

  ('Truist Foundation', 'Bank foundation', 'national', 'C', 'skipped',
   'Open applications cover career pathways and small business only. Housing requests are reviewed only with an invitation code.',
   '$5,000 and up',
   'Screened out 2026-10-08. Revisit if a Truist relationship manager offers an invitation.',
   'Housing not an open category.',
   null, null,
   'https://www.truist.com/purpose/truist-foundation/grant-application',
   'Read via search summary of truist.com.'),

  ('Kresge Foundation', 'Private foundation', 'national', 'C', 'skipped',
   'Not currently accepting unsolicited proposals; open calls are posted on its funding opportunities page.',
   'Not applicable',
   'Screened out 2026-10-08. Watch for open calls.',
   'No unsolicited proposals.',
   null, null,
   'https://kresge.org/',
   'Search summary; confirm on the Kresge site.'),

  ('Melville Charitable Trust', 'Private foundation', 'national', 'C', 'skipped',
   'Works on ending homelessness and housing instability and supports supportive housing, but a directory lists it as invitation-only with a Connecticut focus.',
   'Not published',
   'Screened out 2026-10-08. Verify directly with the Trust if CSH or another partner offers an introduction.',
   'Invitation-only per a third-party directory.',
   null, null,
   'https://www.hinchilla.com/funders-us/461670702-melville-charitable-trust-inc',
   'Third-party directory only; Trust own site not read.'),

  ('Capital One Foundation', 'Bank foundation', 'national', 'C', 'skipped',
   'No Baltimore-specific allocation found. Current open call is about pathways to homeownership, which is not CHA work.',
   'Not applicable',
   'Screened out 2026-10-08.',
   'Fit is weak.',
   null, null,
   'https://www.capitalone.com/about/newsroom/25m-open-call-to-expand-pathways-to-homeownership/',
   'Search summary.'),

  ('Robert Wood Johnson Foundation', 'Private foundation', 'national', 'C', 'skipped',
   'Accepts unsolicited proposals only through its Pioneer program for innovative health ideas; housing and mental health would have to fit that frame.',
   'Not applicable',
   'Screened out 2026-10-08.',
   'Most grants are by call for proposals.',
   null, null,
   'https://www.rwjf.org/',
   'Search summary via third-party pages.'),

  ('Home Depot Foundation', 'Corporate foundation', 'national', 'C', 'skipped',
   'Funded Baltimore veteran housing in 2021, but grants are mostly by direct solicitation and the focus is veterans and skilled trades.',
   'Not applicable',
   'Screened out 2026-10-08.',
   'Mostly invitation-based; veteran focus.',
   null, null,
   'https://corporate.homedepot.com/newsroom/foundation-combats-veteran-homelessness-in-baltimore',
   'Search summary.');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Grants Profile: one row per reusable fact or boilerplate block. Sections group them in the UI.
create table if not exists grants_profile (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  field_key text not null unique,
  label text not null,
  value text,
  kind text not null default 'text' check (kind in ('text','long','document')),
  status text not null default 'needed' check (status in ('needed','draft','approved')),
  source_note text,
  sort integer not null default 0,
  updated_by uuid references employees(id),
  updated_at timestamptz default now()
);
create index if not exists grants_profile_section_idx on grants_profile (section, sort);
alter table grants_profile enable row level security;
-- No policies on purpose, same as funding_pipeline: server actions use the service role after the access check.

insert into grants_profile (section, field_key, label, value, kind, status, source_note, sort) values
  -- Organization
  ('Organization', 'legal_name', 'Legal name', null, 'text', 'needed', 'Confirm exact name on the IRS determination letter', 10),
  ('Organization', 'ein', 'EIN', '52-1600095', 'text', 'draft', 'Form 990 filing (FY ended 6/30/2024); confirm against IRS letter', 20),
  ('Organization', 'tax_status', 'Tax-exempt status', null, 'text', 'needed', 'Expected 501(c)(3); confirm and note determination date', 30),
  ('Organization', 'year_founded', 'Year founded', '1988', 'text', 'draft', 'Form 990', 40),
  ('Organization', 'fiscal_year', 'Fiscal year', 'July 1 to June 30', 'text', 'draft', 'Form 990', 50),
  ('Organization', 'address', 'Mailing address', null, 'text', 'needed', null, 60),
  ('Organization', 'website', 'Website', 'communityhousingassociates.org', 'text', 'draft', null, 70),
  ('Organization', 'staff_count', 'Staff size', '8 employees', 'text', 'draft', 'Form 990 FY2024; update with current headcount', 80),
  ('Organization', 'uei', 'UEI / SAM.gov registration', null, 'text', 'needed', 'Required for federal grants such as SAMHSA', 90),
  ('Organization', 'related_entities', 'Related entities', 'Safe Haven 2, Harford Center LLC, 2828 Loch Raven LLC (disregarded); CHAMI II Inc, CHALP II, CHA Project I Corp; other property entities named on Schedule R', 'long', 'draft', 'Form 990 Schedule R; confirm the current structure', 100),
  -- Leadership and governance
  ('Leadership and governance', 'ceo', 'President / CEO', 'Nico Sanders', 'text', 'draft', 'Add title, bio and years with CHA', 10),
  ('Leadership and governance', 'board_chair', 'Board chair', null, 'text', 'needed', null, 20),
  ('Leadership and governance', 'board_list', 'Board of directors', null, 'long', 'needed', 'FY2024 990 shows 3 voting members (2 independent). Many funders expect more; list names, affiliations and terms', 30),
  ('Leadership and governance', 'development_contact', 'Development / grants contact', null, 'text', 'needed', 'Name, email and phone funders should use', 40),
  ('Leadership and governance', 'independence_story', 'Independence from BHSB', 'CHA ended its legal affiliation with Behavioral Health System Baltimore in 2023 through amended bylaws and charter. Its former sole member forgave $260,961 on 7/1/2023.', 'long', 'draft', 'Form 990 Schedule O; a positive new-independence story, but confirm wording with the CEO', 50),
  -- Mission and programs
  ('Mission and programs', 'mission', 'Mission statement', 'Develop and manage affordable housing for low-income individuals and families in Baltimore City affected by psychiatric disabilities.', 'long', 'draft', 'Form 990; replace with the board-approved mission if different', 10),
  ('Mission and programs', 'population', 'Population served', 'Low-income adults and families in Baltimore City affected by psychiatric disabilities.', 'long', 'draft', 'Form 990; add demographics and referral sources', 20),
  ('Mission and programs', 'units_households', 'Units, households and people served', null, 'text', 'needed', 'Per property, as of a stated date. Most-requested number in applications', 30),
  ('Mission and programs', 'services', 'Services provided to residents', null, 'long', 'needed', 'What CHA provides directly vs. through partners (case management, clinical partners)', 40),
  ('Mission and programs', 'partners', 'Service and referral partners', null, 'long', 'needed', 'Names and roles, with MOUs if they exist', 50),
  ('Mission and programs', 'outcomes', 'Outcomes: retention and stability', null, 'long', 'needed', 'Housing retention rate, move-ins, exits to stable housing. Even simple honest numbers beat none', 60),
  ('Mission and programs', 'resident_story', 'Resident story or quote', null, 'long', 'needed', 'Only with written consent', 70),
  ('Mission and programs', 'need_statement', 'Statement of need', null, 'long', 'needed', 'Baltimore PSH demand, waitlist, and the gap public funding leaves', 80),
  -- Financials
  ('Financials', 'budget', 'Annual operating budget', 'FY2024 expenses: $1,898,546', 'text', 'draft', 'Form 990; replace with the current board-approved budget', 10),
  ('Financials', 'revenue', 'Revenue', 'FY2024 total revenue: $1,966,251 (prior year $2,143,608). Program rents $977,927; management fees $355,138; contributions and grants $369,775.', 'long', 'draft', 'Form 990 FY ended 6/30/2024. Update with FY2025', 20),
  ('Financials', 'funding_mix', 'Funding mix', 'Contributions and grants were almost entirely government ($366,304 of $369,775). All other gifts: $3,471.', 'long', 'draft', 'Form 990 FY2024', 30),
  ('Financials', 'audit', 'Audit status', 'Independently audited on a consolidated basis.', 'text', 'draft', 'Add auditor name and most recent audit date', 40),
  ('Financials', 'current_private_funders', 'Current private funders', null, 'long', 'needed', 'No private funders are known. Confirm; funders will ask who else supports CHA', 50),
  ('Financials', 'public_funding', 'Public funding committed', null, 'long', 'needed', 'Source, amount and term for CoC, ACIS, City and State. Used to show leverage', 60),
  ('Financials', 'funding_gap', 'Itemized funding gap', null, 'long', 'needed', 'What public money does not cover this year. Core of any services or operating ask', 70),
  ('Financials', 'financial_position_statement', 'Financial position, plainly stated', 'In FY2024 CHA reported revenue of $1.97 million and expenses of $1.90 million. The reported surplus includes a one-time $260,961 debt forgiveness; without it the year would have been a deficit of about $193,000. CHA ended the year with $12,215 in cash. Public funds and rents cover the base of the program, and private support is being sought to close the services and operating gap that those sources do not cover.', 'long', 'draft', 'Honest boilerplate drawn from the 990. Update with FY2025 and the CEO plan for stabilization', 80),
  -- Narrative boilerplate
  ('Narrative boilerplate', 'org_short', 'Organization description (about 50 words)', 'Community Housing Associates, founded in 1988, develops and manages affordable housing in Baltimore City for low-income adults and families affected by psychiatric disabilities. CHA is independently governed and audited.', 'long', 'draft', 'Edit freely; reuse in the first paragraph of any application', 10),
  ('Narrative boilerplate', 'org_history', 'Organizational history', null, 'long', 'needed', 'Founding story, key milestones, growth of the portfolio, 2023 independence', 20),
  ('Narrative boilerplate', 'theory_of_change', 'Approach / theory of change', null, 'long', 'needed', 'Why stable housing plus services works for this population', 30),
  ('Narrative boilerplate', 'sustainability', 'Sustainability plan', null, 'long', 'needed', 'How the work continues after a grant ends', 40),
  ('Narrative boilerplate', 'dei_statement', 'Equity and inclusion statement', null, 'long', 'needed', 'If CHA has a statement or policy', 50),
  -- Documents
  ('Documents', 'doc_irs_letter', 'IRS determination letter', null, 'document', 'needed', 'Where the file lives (link or folder)', 10),
  ('Documents', 'doc_990_fy2024', 'Form 990, FY2024', null, 'document', 'needed', 'PDF on file at ~/Downloads (521600095_202406_990)', 20),
  ('Documents', 'doc_990_fy2025', 'Form 990, FY2025', null, 'document', 'needed', null, 30),
  ('Documents', 'doc_audit', 'Most recent audited financial statements', null, 'document', 'needed', null, 40),
  ('Documents', 'doc_budget', 'Current operating budget (board approved)', null, 'document', 'needed', null, 50),
  ('Documents', 'doc_board', 'Board list with affiliations', null, 'document', 'needed', null, 60),
  ('Documents', 'doc_w9', 'W-9', null, 'document', 'needed', null, 70),
  ('Documents', 'doc_org_chart', 'Organizational chart', null, 'document', 'needed', null, 80),
  ('Documents', 'doc_letters', 'Letters of support / MOUs', null, 'document', 'needed', null, 90),
  ('Documents', 'doc_policies', 'Key policies (conflict of interest, whistleblower, etc.)', null, 'document', 'needed', 'Some funders ask for these', 100),
  ('Documents', 'doc_logo', 'Logo and photos (with releases)', null, 'document', 'needed', null, 110);
