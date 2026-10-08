-- CHA Employee Portal — Migration 023: funder website and application URLs on each record
-- website_url: the funder (or administering agency) home page. application_url: the grant guidelines / application page or portal landing page.
-- source_url stays as the page the research relied on. Backfill covers only URLs that were seen in research; verify before outreach.

alter table funding_pipeline add column if not exists website_url text;
alter table funding_pipeline add column if not exists application_url text;
alter table funding_suggestions add column if not exists website_url text;
alter table funding_suggestions add column if not exists application_url text;

update funding_pipeline p set website_url = v.site, application_url = v.apply
from (values
  ('Abell Foundation', 'https://abell.org/', 'https://abell.org/grants/'),
  ('Annie E. Casey Foundation', 'https://www.aecf.org/', null),
  ('Baltimore Community Foundation + Weinberg Foundation (Baltimore City Community Grants)', 'https://www.bcf.org/', 'https://www.bcf.org/grants/'),
  ('Bank of America Charitable Foundation (Neighborhood Builders)', 'https://about.bankofamerica.com/', 'https://about.bankofamerica.com/en/making-an-impact/grant-funding-for-nonprofits-sponsorship-programs'),
  ('Capital One Foundation', 'https://www.capitalone.com/', null),
  ('CareFirst BlueCross BlueShield (community impact)', 'https://www.carefirst.com/', null),
  ('Conrad N. Hilton Foundation (national)', 'https://www.hiltonfoundation.org/', null),
  ('Elevance Health Foundation', 'https://www.elevancehealth.com/', null),
  ('France-Merrick Foundation', 'https://www.france-merrickfdn.org/', null),
  ('Goldseker Foundation', 'https://goldsekerfoundation.org/', null),
  ('Harry and Jeanette Weinberg Foundation (Baltimore)', 'https://hjweinbergfoundation.org/', 'https://hjweinbergfoundation.org/grants/grant-faq/'),
  ('Hoffberger Family Philanthropies', 'https://www.hoffberger.org/', 'https://www.hoffberger.org/grant-process/'),
  ('Home Depot Foundation', 'https://corporate.homedepot.com/', null),
  ('HUD Section 811 Project Rental Assistance (via Maryland DHCD)', 'https://dhcd.maryland.gov/', 'https://dhcd.maryland.gov/HousingDevelopment/Pages/section811.aspx'),
  ('Kresge Foundation', 'https://kresge.org/', null),
  ('M&T Charitable Foundation', 'https://www.mtb.com/', 'https://www.mtb.com/about-mt/charitable-contributions'),
  ('Maryland Behavioral Health Administration: Community Bond capital program', 'https://health.maryland.gov/bha/', null),
  ('Maryland Community Health Resources Commission (CHRC)', 'https://health.maryland.gov/mchrc/', 'https://health.maryland.gov/mchrc/Pages/home.aspx'),
  ('Maryland Community Investment Tax Credit (DHCD)', 'https://dhcd.maryland.gov/', 'https://dhcd.maryland.gov/communities/pages/programs/citc.aspx'),
  ('Morris and Gwendolyn Cafritz Foundation', 'https://www.cafritzfoundation.org/', null),
  ('Peg''s Foundation (mental health)', 'https://pegsfoundation.org/', null),
  ('PNC Foundation (affordable housing)', 'https://www.pnc.com/', 'https://www.pnc.com/en/about-pnc/corporate-responsibility/philanthropy/pnc-foundation.html'),
  ('Robert Wood Johnson Foundation', 'https://www.rwjf.org/', null),
  ('SAMHSA Grants for the Benefit of Homeless Individuals (GBHI)', 'https://www.samhsa.gov/', 'https://www.samhsa.gov/communities/homelessness-programs-resources/grants/gbhi'),
  ('Truist Foundation', 'https://www.truist.com/', 'https://www.truist.com/purpose/truist-foundation/grant-application'),
  ('Wells Fargo and Enterprise: Housing Affordability Breakthrough Challenge', 'https://www.enterprisecommunity.org/', null)
) as v(name, site, apply)
where p.funder = v.name;

update funding_pipeline set website_url = 'https://www.csh.org/' where funder like 'Corporation for Supportive Housing%' and website_url is null;
