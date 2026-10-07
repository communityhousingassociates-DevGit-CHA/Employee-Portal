'use client'

// Read-only reference tabs for Executive Funding: CHA's 990 snapshot, public leverage, and the 90-day plan.
// Source: research prepared 2026-10-03 (~/cha/psh-funding). Edit the arrays below to update the text.

export type ReferenceTab = 'finances' | 'leverage' | 'plan'

const FINANCE: { label: string; value: string | number; note?: string }[] = [
  { label: 'Source', value: 'Form 990, FY 7/1/2023 to 6/30/2024 (filed May 2025)', note: 'EIN 52-1600095. Over a year old. Update with FY2025 figures when available.' },
  { label: 'Mission (990)', value: 'Develop and manage affordable housing for low-income individuals and families in Baltimore City affected by psychiatric disabilities' },
  { label: 'Founded / staff / board', value: '1988 / 8 employees / 3 voting board members (2 independent)', note: 'A small board is a likely funder question.' },
  { label: 'Total revenue', value: 1966251, note: 'Prior year $2,143,608' },
  { label: 'Total expenses', value: 1898546, note: 'Prior year $2,065,569' },
  { label: 'Program rents', value: 977927, note: 'About 50% of revenue' },
  { label: 'Management fees', value: 355138 },
  { label: 'Contributions and grants', value: 369775, note: 'Prior year $634,969. Government grants $366,304. All other gifts $3,471.' },
  { label: 'One-time debt forgiveness', value: 260961, note: 'Forgiven 7/1/2023 by Behavioral Health System Baltimore, Inc., CHA\'s former sole member (Schedule O). Without it, the CHA-only year is about a $193K deficit (67,705 less 260,961).' },
  { label: 'Surplus as reported', value: 67705 },
  { label: 'Cash at year end', value: 12215, note: 'Down from $175,241 at the start of the year.' },
  { label: 'Total assets / liabilities', value: '$1,262,241 / $1,024,041' },
  { label: 'Net assets', value: '$238,200 total: -$326,945 without donor restrictions, +$565,145 with donor restrictions', note: 'Unrestricted deficit. The donor-restricted balance should be explained.' },
  { label: 'Independence', value: 'Legal affiliation with Behavioral Health System Baltimore ended through amended bylaws and charter (2023)', note: 'Newly independent. Tell this story. BHSB is also a relationship to cultivate.' },
  { label: 'Audited consolidated totals (Sched. D XI/XII)', value: 'Revenue $2,374,260 / expenses $2,635,165', note: 'Consolidated expenses exceed revenue by about $261K.' },
  { label: 'Affiliates inside the consolidation', value: 'Revenue $408,009 / expenses $736,619', note: 'Affiliate and property entities run a gap of about $329K. This is the most concrete basis for the services and operating ask. Confirm what is in the expenses (debt service, depreciation) with the auditor before quoting it.' },
  { label: 'Due from related parties / lines of credit', value: '$417,747 / $349,257', note: 'Balance sheet items funders may ask about.' },
  { label: 'Audit', value: 'Independently audited, consolidated basis', note: 'Meets a common funder requirement.' },
  { label: 'Public support 2019-2023', value: '$338,802 / $358,929 / $343,268 / $634,969 / $369,775', note: 'Essentially all government. Private philanthropy is near zero.' },
  { label: 'Related property entities (Sched. R)', value: 'Disregarded: Safe Haven 2, Harford Center LLC, 2828 Loch Raven LLC. Corps and partnerships: CHAMI II Inc, CHALP II, CHA Project I Corp. Related 501(c)(3)s with transactions: 2301 N Charles St Inc, 18 W Read St Inc, Belair Manor Inc, Glenmore Housing Inc, CHA LP2, Housing Associates Inc, Charm City Housing Associates Inc, 4227 Frederick Ave Inc, Community Housing Development Corp', note: 'Schedule R names entities only. Unit counts, addresses and populations per property are still needed for the case statement.' },
]

const BUCKETS = [
  { title: 'A. Services and operating gap', what: 'Case management, clinical partnerships, resident stability supports not covered by vouchers or CoC.', who: 'Abell, France-Merrick, Weinberg, hospital/ACIS. Start here.' },
  { title: 'B. Capital and unit upkeep', what: 'Rehab, accessibility, systems replacement, new units.', who: 'Weinberg capital, Goldseker, CSH and Housing Accelerator predevelopment. Avoid leading with capital until the cash position has a plan.' },
  { title: 'C. Capacity', what: 'Data and outcomes tracking, development staff, grant-writing support.', who: 'Small Abell grants, BCF/Weinberg community grants, CSH Institute.' },
]

const STILL_NEEDED = [
  'Units and households per property',
  'Retention and move-out outcomes',
  'Confirmation that CHA has no current private funders (none are known)',
  'FY2025 numbers',
  'An itemized funding gap',
  'Fact sheet: mission one-liner, EIN and 501(c)(3) status, budget and audit status, population served, public funding committed, board chair, ED/CEO and development contact',
]

const LEVERAGE = [
  { name: 'HUD Continuum of Care (Baltimore City CoC / MOHS)', what: 'More than 75% of Baltimore CoC funding goes to PSH. The CoC awarded over $31M last cycle.', why: 'Funders want to see committed public operating dollars. CoC and ACIS are the base that private grants fill gaps around.', status: 'FY2026 competition portal closed 7/15/2026.', link: 'https://www.baltimorecity.gov/homeless' },
  { name: 'Baltimore Housing Accelerator Fund / HOME-ARP', what: 'City $30M fund with PSH predevelopment support.', why: 'Predevelopment grants cover early costs private funders will not.', status: 'Check the current round with DHCD.', link: 'https://www.marylandphilanthropy.org/news/baltimore-city-announces-30-million-housing-accelerator-fund' },
  { name: 'Consolidated Funding Application FY2026 (ESG, MD HSP, HOPWA, DSS, Opioid Restitution, General Fund)', what: 'City blended funding competition.', why: 'Shows leveraged public match.', status: 'See the City page for timing.', link: 'https://www.baltimorecity.gov/homeless/resources-for-service-providers/consolidated-funding-application-fy-2026' },
]

const WANTS = [
  { t: 'Outcomes data', d: 'Housing retention rate, move-ins, exits to stable housing, cost per household. Benchmark: Baltimore\'s ACIS pilot reported 94% stably housed at two years.' },
  { t: 'Leverage', d: 'Public dollars already committed (CoC, ACIS, City), shown as a ratio to the private ask.' },
  { t: 'A clear gap', d: 'A budget showing exactly what public funding does not cover.' },
  { t: 'Resident voice', d: 'A short story or quote, with consent.' },
  { t: 'Sustainability', d: 'How the work continues after the grant.' },
]

const PLAN = [
  ['Week 1 (by Oct 10)', 'Fill in the CHA fact sheet. Call BCF, Weinberg and CSH to confirm process and next windows.'],
  ['Oct 12-13', 'CSH Maryland Supportive Housing Summit (Baltimore). Attend and meet funders and peers.'],
  ['Weeks 2-3', 'Register for the Abell info session or send an LOI. Verify France-Merrick guidelines and send an LOI.'],
  ['Weeks 3-6', 'Review ACIS expansion RFP status. Explore the hospital partnership route.'],
  ['Weeks 6-12', 'Full proposals for invited funders. Set up the reporting calendar.'],
]

const SUCCESS = [
  '6+ funder conversations held',
  '3+ LOIs or applications submitted',
  'At least one multi-year commitment toward the services gap',
  'A reusable outcomes dashboard in place',
]

const CAUTIONS = [
  'Not every funder was verified directly. France-Merrick\'s site did not load and Weinberg\'s application path is unconfirmed.',
  'The 990 shows a tight operating position. A credible plan for what the grant fixes is stronger than hiding it.',
  'Most Baltimore private funders prefer an intro call before a proposal.',
  'The 990 is over a year old. Update with FY2025 numbers before anything goes out.',
  'Public pages and aggregators disagree on dates. Confirm every date with the funder.',
]

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const card = 'bg-white border border-[#d4eef2] rounded-xl overflow-hidden shadow-sm'
const h2 = 'text-[11px] uppercase tracking-widest font-bold text-[#028a9e] mb-2'

function List({ items }: { items: string[] }) {
  return <ul className="list-disc pl-5 space-y-1 text-[13px] text-gray-700">{items.map(i => <li key={i}>{i}</li>)}</ul>
}

export default function FundingReference({ tab }: { tab: ReferenceTab }) {
  if (tab === 'finances') {
    return (
      <div className="space-y-5">
        <p className="text-[13px] text-gray-500 max-w-[75ch]">From the Form 990 for the year ended 6/30/2024. Funders read 990s, so explain these numbers plainly before they ask.</p>
        <div className="bg-[#fff8e6] border border-amber-200 text-[#0b2b35] text-[13px] rounded-lg px-4 py-3 max-w-[85ch]">
          The reported $67,705 surplus includes $260,961 of one-time debt forgiveness. Without it the CHA-only year was roughly a $193K deficit. Private giving was $3,471 against about $366K of government grants.
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className={card + ' p-4'}>
            <h2 className={h2}>Strengths to lead with</h2>
            <List items={['Independent audit', '35+ years of operation (founded 1988)', 'Stable rent revenue, about 50% of total', 'A clear mission that matches funder priorities for people with disabilities', 'New independence from BHSB in 2023, a fundraising story']} />
          </div>
          <div className={card + ' p-4'}>
            <h2 className={h2}>Questions funders will ask</h2>
            <List items={['Who else supports CHA? (Almost no private money today.)', 'Why is cash only $12K and unrestricted net assets negative?', 'Board of 3 voting members. Consider expanding before major asks.', 'Outcomes: retention, move-ins, exits to stable housing, cost per household']} />
          </div>
        </div>
        <div className={card}>
          {FINANCE.map(f => (
            <div key={f.label} className="grid sm:grid-cols-[minmax(160px,1fr)_2fr] gap-x-5 gap-y-1 px-4 py-3 border-b border-[#f0f7f8] last:border-0">
              <div className="text-[13px] font-semibold text-[#0b2b35]">{f.label}</div>
              <div className="text-[13px] text-gray-800 break-words">{typeof f.value === 'number' ? money(f.value) : f.value}</div>
              {f.note && <div className="sm:col-start-2 text-[12px] text-gray-500 break-words">{f.note}</div>}
            </div>
          ))}
        </div>
        <div>
          <h2 className={h2}>What to ask for</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {BUCKETS.map(b => (
              <div key={b.title} className={card + ' p-4'}>
                <h3 className="text-[13px] font-bold text-[#0b2b35] mb-0.5">{b.title}</h3>
                <p className="text-[13px] text-gray-700 mt-1">{b.what}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-3">Best-fit funders</p>
                <p className="text-[13px] text-gray-700">{b.who}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={card + ' p-4'}>
          <h2 className={h2}>Still needed from CHA</h2>
          <List items={STILL_NEEDED} />
        </div>
      </div>
    )
  }

  if (tab === 'leverage') {
    return (
      <div className="space-y-5">
        <p className="text-[13px] text-gray-500 max-w-[75ch]">Private grants work best closing the gap that public dollars leave, not replacing the public base. Show committed public money next to every private ask.</p>
        <div className={card}>
          {LEVERAGE.map(l => (
            <div key={l.name} className="px-4 py-3 border-b border-[#f0f7f8] last:border-0">
              <p className="text-[13px] font-semibold text-[#0b2b35]">{l.name}</p>
              <p className="text-[13px] text-gray-800 mt-0.5">{l.what}</p>
              <p className="text-[12px] text-gray-500 mt-1 break-words">Why it matters: {l.why} Status (2026-10-03): {l.status}{' '}
                <a href={l.link} target="_blank" rel="noopener noreferrer" className="text-[#028a9e] hover:underline">Source ↗</a>
              </p>
            </div>
          ))}
        </div>
        <div>
          <h2 className={h2}>What funders want to see</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {WANTS.map(w => (
              <div key={w.t} className={card + ' p-4'}>
                <h3 className="text-[13px] font-bold text-[#0b2b35] mb-0.5">{w.t}</h3>
                <p className="text-[13px] text-gray-700 mt-1">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-gray-500 max-w-[75ch]">Sequence: a small Abell grant or info session to start a relationship, then Weinberg and Abell/France-Merrick LOIs for a services-gap ask, with the hospital/ACIS route in parallel.</p>
      <div className={card}>
        {PLAN.map(([when, what]) => (
          <div key={when} className="grid sm:grid-cols-[170px_1fr] gap-x-4 gap-y-1 px-4 py-3 border-b border-[#f0f7f8] last:border-0">
            <div><span className="inline-block text-[11px] font-bold bg-[#e0f5f8] text-[#028a9e] px-2.5 py-1 rounded-full">{when}</span></div>
            <div className="text-[13px] text-gray-800">{what}</div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className={card + ' p-4'}>
          <h2 className={h2}>Measures of success at 6 months</h2>
          <List items={SUCCESS} />
        </div>
        <div className={card + ' p-4'}>
          <h2 className={h2}>Cautions</h2>
          <List items={CAUTIONS} />
        </div>
      </div>
    </div>
  )
}
