import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white rounded-xl border border-[#d4eef2] p-6 scroll-mt-6">
      <h2 className="text-[16px] font-bold text-[#0b2b35] mb-4">{title}</h2>
      <div className="space-y-3 text-[13px] text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 list-none">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="text-[#02ACC0] flex-shrink-0 mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Numbered({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 list-none">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-[#e0f5f8] text-[#028a9e] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#f0f7f8]">
            {head.map((h, i) => <th key={i} className="text-left py-1.5 font-semibold text-[#0b2b35] pr-4">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#f0f7f8] last:border-0">
              {row.map((cell, j) => <td key={j} className="py-1.5 pr-4 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TOC = [
  { id: 'purpose', label: '1. Purpose & Scope' },
  { id: 'contact', label: '2. Who to Contact' },
  { id: 'time-entry', label: '3. Time Entry' },
  { id: 'leave', label: '4. Leave Requests' },
  { id: 'expenses', label: '5. Expense & Mileage Reimbursement' },
  { id: 'payroll', label: '6. Payroll Cutoff & Pay Dates' },
  { id: 'issues', label: '7. Error, Discrepancy & Issue Reporting' },
  { id: 'security', label: '8. Account Security' },
  { id: 'effective', label: '9. Effective Date' },
]

export default async function StaffSopPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')
  const isManager = MANAGER_ROLES.includes(employee.role)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Staff SOP</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Standard Operating Procedure — Time Entry, Leave Requests, Expense Reimbursement &amp; Issue Reporting. September 22, 2026.
            {isManager && <> See the companion <Link href="/sop/admin" className="text-[#02ACC0] font-semibold hover:underline">Admin &amp; Leadership SOP</Link> for approvals and admin-only policy.</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        <nav className="bg-white rounded-xl border border-[#d4eef2] p-4 lg:sticky lg:top-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">On this page</p>
          <div className="flex flex-col gap-0.5">
            {TOC.map(t => (
              <a key={t.id} href={`#${t.id}`} className="text-[12px] text-gray-600 hover:text-[#02ACC0] py-1 transition-colors">{t.label}</a>
            ))}
          </div>
        </nav>

        <div className="space-y-5">
          <Section id="purpose" title="1. Purpose & Scope">
            <p>This SOP defines how Community Housing Associates (CHA) staff are expected to record time worked, request leave, submit reimbursable expenses, and report errors or discrepancies using the <strong className="text-[#0b2b35]">CHA Employee Portal</strong> (<code className="bg-[#f0f7f8] px-1.5 py-0.5 rounded text-[12px]">portal.communityhousingassociates.org</code>). It applies to every employee with a portal account.</p>
            <p>Step-by-step click-through instructions live in the portal itself — sidebar → <Link href="/guide" className="text-[#02ACC0] hover:underline">How-To Guide</Link>. This document sets the policy those steps follow. Accounting Manager and CEO responsibilities (timesheet review, approvals, admin settings) are covered in a separate, expanded Admin &amp; Leadership SOP — this edition covers what applies to every employee.</p>
            <p><strong className="text-[#0b2b35]">Current status:</strong> the portal is running in <strong>parallel</strong> with CHA&apos;s existing time and leave system for a trial period. It is not yet the system of record — continue following existing CHA processes alongside portal use until leadership confirms cutover.</p>
          </Section>

          <Section id="contact" title="2. Who to Contact">
            <Table
              head={['Situation', 'Contact']}
              rows={[
                ["Can't sign in, invite/reset link expired", 'System Administrator (Globalist Pro)'],
                ['A balance, timesheet, or pay figure looks wrong', 'Accounting Manager — Carrileen Edwards (cedwards@communityhousingmd.org)'],
                ['Anything else that seems broken', 'Report it the same way — see Section 7'],
              ]}
            />
          </Section>

          <Section id="time-entry" title="3. Procedure — Time Entry">
            <Numbered items={[
              <><strong className="text-[#0b2b35]">Pay period.</strong> Time is recorded on a <strong>bi-weekly</strong> (14-day) cycle, target 80 hours per period.</>,
              <><strong className="text-[#0b2b35]">Daily entry.</strong> Enter hours worked each day under Regular. Hourly employees enter Regular hours directly; salaried employees&apos; Regular hours are system-calculated as 8 minus Leave hours for each day. The Leave column cannot be typed in — it is filled automatically from approved leave requests (including automatically approved sick leave), so time off must be requested first. Scheduled holidays are filled in automatically as <strong>Holiday</strong> hours (instead of Regular) so holiday time is tracked separately. A timesheet with no leave can be submitted for approval as normal; if you have a leave request still pending in that pay period, get it decided before submitting so the leave appears on the timesheet.</>,
              <><strong className="text-[#0b2b35]">Save frequently.</strong> The system autosaves during entry; you may also save manually at any point before submitting.</>,
              <><strong className="text-[#0b2b35]">Deadline.</strong> The timesheet for a pay period is due <strong>2 calendar days after the period ends</strong>. You&apos;re responsible for submitting on time. The Dashboard shows an automatic reminder starting 2 days before the cutoff (and again 1 day before) if your timesheet is still unsubmitted.</>,
              <><strong className="text-[#0b2b35]">Certification.</strong> Before submission, you must electronically sign, certifying the hours logged are accurate and complete.</>,
              <><strong className="text-[#0b2b35]">Submission.</strong> Once submitted, the timesheet is locked from further edits. Your approver is notified by email and in the portal, and must approve it in the portal. You are notified of the outcome the same way: if approved, it is marked <strong>Approved</strong>; if returned for correction, it unlocks with the reason shown at the top of the timesheet, and you must fix it and resubmit.</>,
              <><strong className="text-[#0b2b35]">Corrections after submission.</strong> If you discover an error after submitting, use <strong>Request a correction</strong> on the timesheet (with a note on what is wrong). Your approver reopens it for you — you then fix it and resubmit for approval. Before payroll is due any approver can reopen it; once payroll is due, only the CEO can (a documented override), so report errors promptly.</>,
            ]} />
          </Section>

          <Section id="leave" title="4. Procedure — Leave Requests">
            <p><strong className="text-[#0b2b35]">Leave types.</strong> PTO, Sick Leave, and Vacation draw from your leave balance. Bereavement and Jury Duty do not draw from any balance.</p>
            <p className="font-semibold text-[#0b2b35]">Submission</p>
            <Numbered items={[
              <>Leave must be requested through the portal <strong>before</strong> it is taken (except where illness prevents advance notice — submit as soon as practical).</>,
              'Leave is recorded in hourly increments; 8 hours = 1 full workday.',
              'Check the Team Leave Calendar for overlapping team absences before submitting.',
              <>The request must be electronically signed before submission. An attachment is optional for every leave type except Jury Duty, where the summons is required — the portal blocks submission without it.</>,
              <><strong>PTO, Vacation, Jury Duty, and Bereavement</strong> require approval. Submitting one notifies your approvers by email and in the portal. It stays <strong>Pending</strong> until an approver acts in the portal; don&apos;t take leave on the assumption of approval until status changes to <strong>Approved</strong>. When the request is approved or denied you receive an email and a portal notification (the bell icon in the top bar); a denial includes the approver&apos;s reason if one was given. <strong>Sick leave</strong> does not need approval as long as you have enough sick balance to cover it: it is approved automatically when you submit, your balance is reduced, and the days appear on your timesheet. A sick request larger than your available balance goes to an approver like any other request.</>,
            ]} />
            <p className="font-semibold text-[#0b2b35]">Accrual policy</p>
            <Table
              head={['Tenure', 'PTO accrual / pay period']}
              rows={[
                ['0–12 months', '4.62 hrs'],
                ['13–24 months', '5.08 hrs'],
                ['25–36 months', '5.54 hrs'],
                ['36+ months', '6.00 hrs'],
              ]}
            />
            <p>Sick leave accrues at a flat <strong>3.69 hrs per pay period</strong> for all tenures.</p>
            <p className="font-semibold text-[#0b2b35]">Caps &amp; resets</p>
            <Bullets items={[
              <>PTO carries over up to a <strong>400-hour cap</strong>; hours accrued beyond the cap are forfeited.</>,
              <>Sick leave has <strong>no cap</strong>.</>,
              <>Vacation day balances <strong>reset every January 1</strong>.</>,
              'A request that would take a balance negative is allowed but flagged for manager approval.',
            ]} />
          </Section>

          <Section id="expenses" title="5. Procedure — Expense & Mileage Reimbursement">
            <p><strong className="text-[#0b2b35]">Eligible categories:</strong> Mileage, Hotel, Airline, Meals, Entertainment, Cash Advance, Tolls, Conference Fees, Rental Car, Gratuities, Parking, Other.</p>
            <p><strong className="text-[#0b2b35]">Mileage</strong> is reimbursed at the current rate per mile, set annually by the Accounting Manager. If a rate hasn&apos;t been set for the current year, flag it to the Accounting Manager rather than estimate.</p>
            <p><strong className="text-[#0b2b35]">Receipts</strong> are optional in the system but should be attached (image or PDF) whenever available, consistent with CHA&apos;s standard expense documentation practice.</p>
            <p><strong className="text-[#0b2b35]">Approval.</strong> Submitted expenses route to the Accounting Manager/CEO for review, who are notified by email and in the portal, and show status Pending → Approved/Denied. You receive an email and a portal notification when an expense is decided, and a denied expense includes a reason where one was provided.</p>
          </Section>

          <Section id="payroll" title="6. Payroll Cutoff & Pay Dates">
            <p>Pay period cadence, anchor, and the timesheet submission cutoff are confirmed below. Payroll processing cutoff and pay date(s) remain pending.</p>
            <Table
              head={['Item', 'Value']}
              rows={[
                ['Pay period cadence', 'Bi-weekly (14 days) — confirmed'],
                ['Pay period anchor / start date', 'Periods start 2026-01-14 and every 14 days after (e.g. 2026-09-09, 2026-09-23, 2026-10-07, …)'],
                ['Timesheet submission cutoff', '2 calendar days after each period ends.'],
                ['Payroll processing cutoff', '12 calendar days after each period ends — PROVISIONAL, pending confirmation of CHA&apos;s payroll schedule (e.g. payroll for the period ending 2026-09-12 was due 2026-09-24)'],
                ['Pay date(s)', 'TBD — pending CHA&apos;s payroll schedule (direct deposit for the period ending 2026-09-12 is 2026-09-29)'],
              ]}
            />
            <p>Until pay dates are confirmed, continue following CHA&apos;s existing payroll calendar for actual pay timing — the portal&apos;s period display should not yet be treated as authoritative for pay dates.</p>
          </Section>

          <Section id="issues" title="7. Error, Discrepancy & Issue Reporting">
            <p>The portal has an in-app <strong className="text-[#0b2b35]">Report an Issue</strong> form (sidebar → Report an Issue) that notifies the Accounting Manager and admin team automatically, with reply-to set to you. A screenshot or file can be attached. Use it as the default reporting channel — the contacts in Section 2 still apply for anything that needs a named person directly, or if the form itself is unavailable.</p>
            <p><strong className="text-[#0b2b35]">During the 30-day parallel run</strong>, compare your portal timesheet and leave balances against CHA&apos;s existing system weekly and report any mismatch immediately rather than waiting.</p>
          </Section>

          <Section id="security" title="8. Account Security">
            <Bullets items={[
              <>Invite links are valid for <strong>24 hours</strong> from the time the invite is sent.</>,
              <>Password reset links are valid for <strong>24 hours</strong>.</>,
              <>Passwords must be at least <strong>8 characters</strong>.</>,
              'Credentials are personal and must not be shared; you’re individually responsible for the accuracy of entries and e-signatures made under your own login.',
            ]} />
          </Section>

          <Section id="effective" title="9. Effective Date">
            <p>September 23, 2026 (portal invite rollout). Status: parallel run — the portal is supplementary, not yet the system of record. This SOP will be reviewed at the end of the 30-day parallel run alongside the go/no-go cutover decision.</p>
          </Section>
        </div>
      </div>
    </div>
  )
}
