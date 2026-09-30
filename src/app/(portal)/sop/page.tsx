import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getPayCalendar } from '@/lib/pay-periods'
import { fmtDate, fmtDateRange } from '@/lib/format-date'

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
  { id: 'benefits', label: '5. Benefits Summary' },
  { id: 'expenses', label: '6. Expense & Mileage Reimbursement' },
  { id: 'payroll', label: '7. Pay Periods & Pay Dates' },
  { id: 'issues', label: '8. Error, Discrepancy & Issue Reporting' },
  { id: 'security', label: '9. Account Security' },
  { id: 'effective', label: '10. Effective Date' },
]

export default async function StaffSopPage() {
  const payCalendar = getPayCalendar(6)
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
                ['Anything else that seems broken', 'Report it the same way — see Section 8'],
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
              <><strong className="text-[#0b2b35]">Corrections after submission.</strong> If you discover an error after submitting, use <strong>Request a correction</strong> on the timesheet (with a note on what is wrong). Your approver reopens it for you — you then fix it and resubmit for approval. While the pay period is open any approver can reopen it; once accounting has closed the period, only the CEO can (a documented override), so report errors promptly.</>,
            ]} />
          </Section>

          <Section id="leave" title="4. Procedure — Leave Requests">
            <p><strong className="text-[#0b2b35]">Leave types.</strong> Full-time employees receive paid <strong>annual leave</strong> (tracked in the portal as PTO), <strong>personal leave</strong> (tracked as <strong>Personal Days</strong>), and paid <strong>sick and safe leave</strong> (&ldquo;sick leave&rdquo;), each drawn from your leave balance. <strong>Administrative leave</strong> (jury duty/witness service, election voting, workers&apos; compensation, bereavement, and military service) and <strong>holiday leave</strong> are paid but do not accrue and do not draw from any balance. <strong>Flex Time</strong>, earned by exempt employees for holiday work, is a separate balance and can be requested as leave. <strong>Unpaid leave</strong> is time off without pay: it draws from no balance, requires approval, and is flagged as unpaid on the timesheet and in payroll reports. Part-time employees and independent contractors accrue neither annual, personal, nor sick leave.</p>
            <p className="font-semibold text-[#0b2b35]">Submission</p>
            <Numbered items={[
              <>Leave should be requested through the portal <strong>as it happens</strong> — planned leave (PTO, Personal Days, Bereavement, Jury Duty) can be requested as far ahead as needed, through 12-31-2027, and should be requested as soon as it is known; <strong>Sick leave</strong> for a foreseeable need (such as a planned medical appointment) can be requested ahead of time — give at least 7 days&apos; notice when it is known that far in advance; otherwise enter it as soon as practicable, including after the fact — so timesheets stay current. Dates up to <strong>14 days in the past</strong> can be entered to catch up (through 10-08-2026, entries back to 09-13-2026 are accepted so the current pay period can be brought up to date); earlier dates are not accepted in the portal and must go through the Accounting Manager. Once accounting closes out a pay period, no further changes or requests are made for it.</>,
              'Leave is recorded in hourly increments; 8 hours = 1 full workday.',
              'Check the Team Leave Calendar for overlapping team absences before submitting.',
              <>The request must be electronically signed before submission. An attachment is optional for every leave type except Jury Duty, where the summons is required — the portal blocks submission without it.</>,
              <><strong>PTO, Personal Days, Jury Duty, and Bereavement</strong> require approval. Submitting one notifies your approvers by email and in the portal. It stays <strong>Pending</strong> until an approver acts in the portal; don&apos;t take leave on the assumption of approval until status changes to <strong>Approved</strong>. When the request is approved or denied you receive an email and a portal notification (the bell icon in the top bar); a denial includes the approver&apos;s reason if one was given. <strong>Sick leave</strong> does not need approval as long as you have enough sick balance to cover it: it is approved automatically when you submit, your balance is reduced (for sick leave starting more than two pay periods out, the hours are reserved and come off closer to the date, as with PTO), and the days appear on your timesheet. A sick request larger than your available balance goes to an approver like any other request. <strong>Leave starting within the next two pay periods comes off your balance as soon as it is approved.</strong> <strong>Leave planned further out is reserved, not deducted:</strong> it is checked against your projected balance for the start date (today&apos;s balance plus the accruals expected by then, minus other reserved leave) and comes off your balance once it is within two pay periods of the start date. The projected hours must actually be available on that day for the leave to be valid; if they are not, you and your approvers are notified.</>,
            ]} />
            <p className="font-semibold text-[#0b2b35]">Accrual policy (full-time employees)</p>
            <Table
              head={['Leave', 'Tenure', 'Accrual', 'Approx. annual']}
              rows={[
                ['Annual leave (PTO)', '0–12 months', '4.62 hrs per pay period', '120 hrs'],
                ['', '13–24 months', '5.08 hrs per pay period', '132 hrs'],
                ['', '25–36 months', '5.54 hrs per pay period', '144 hrs'],
                ['', 'Over 36 months', '6.00 hrs per pay period', '156 hrs'],
                ['Personal Days', 'Any tenure', 'Granted January 1 each year (3 days)', '24 hrs'],
                ['Sick leave', 'Any tenure', '3.69 hrs per pay period', '96 hrs'],
              ]}
            />
            <p>For purposes of annual and sick leave accrual, full-time employees are assumed to work 80 hours per pay period.</p>
            <p className="font-semibold text-[#0b2b35]">Carryover</p>
            <Bullets items={[
              <>Unused accrued annual, personal, and sick leave may be carried over from one year to the next, up to a <strong>combined</strong> limit: <strong>240 hours</strong> if you have fewer than 60 months of tenure, or <strong>400 hours</strong> if you have 60 or more months of tenure. The limit applies to the <em>sum</em> of annual, personal, and sick hours — not to each type separately. For example, an employee with 40 months of tenure who ends the year with 200 hours of annual leave, 16 hours of personal leave, and 100 hours of sick leave (316 hours in all) may carry over no more than 240 hours in total.</>,
              'A request that would take a balance negative is allowed but flagged for approval.',
            ]} />
            <p className="font-semibold text-[#0b2b35]">Eligibility &amp; timing</p>
            <Bullets items={[
              <>Annual leave and sick leave may not be taken until you have been employed by CHA for at least <strong>90 days</strong>. Personal Days may not be taken until you have been employed for at least <strong>6 months</strong>. Exceptions may be granted in the sole and absolute discretion of CHA&apos;s President and CEO.</>,
              <>Request your supervisor&apos;s approval of planned annual leave <strong>at least one week in advance</strong>. CHA will try to accommodate the request, but approval is conditioned on adequate staffing during the absence.</>,
              <>If you can foresee a need for sick leave at least 7 days ahead, you must give your supervisor <strong>at least 7 days&apos; notice</strong>. Otherwise, inform your supervisor as soon as practicable about the use or planned use of sick leave.</>,
            ]} />
            <p className="font-semibold text-[#0b2b35]">Payout on separation</p>
            <Bullets items={[
              <>If you voluntarily resign from CHA, CHA pays for up to <strong>120 hours</strong> of accrued annual leave when a <strong>Director</strong> gives at least <strong>4 weeks&apos;</strong> notice of the effective date of resignation, or a <strong>non-Director</strong> gives at least <strong>2 weeks&apos;</strong> notice.</>,
              'Otherwise, CHA does not pay for any accrued annual leave when employment ends, whether voluntarily or involuntarily. Whether an employee is a Director is set on their profile by the Accounting Manager, and the resignation payout calculator on the employee&apos;s page applies this rule.',
              <>CHA <strong>never</strong> pays out accrued sick leave when employment ends.</>,
            ]} />
            <p className="font-semibold text-[#0b2b35]">Administrative leave</p>
            <p>Paid administrative leave is not subject to accrual:</p>
            <Bullets items={[
              <><strong>Jury duty / witness service.</strong> Paid at the regular wage rate for jury duty served, or witness service provided in a matter that is not your own litigation, during regular hours of employment. The summons must be attached to the leave request.</>,
              <><strong>Election voting.</strong> 4 hours of paid leave to vote during normal working hours. If the distance between home and work prevents voting outside working hours, an additional 2 hours (6 in all) may be approved by the supervisor. Choose "Extra +2" on the request; the approver reviews it against this policy.</>,
              <><strong>Workers&apos; compensation.</strong> For an on-the-job injury covered by Maryland&apos;s workers&apos; compensation law, where that law does not pay temporary total disability benefits for the first 3 days of disability, those 3 days are paid leave.</>,
              <><strong>Bereavement.</strong> At the supervisor&apos;s discretion, up to 3 days of paid bereavement leave for the death of a significant other or a family member (grandparent, parent, sibling, child, or grandchild) of you or your significant other.</>,
              <><strong>Military service.</strong> CHA provides any paid leave required by applicable law for military service.</>,
            ]} />
            <p className="font-semibold text-[#0b2b35]">Holiday leave</p>
            <p>CHA observes the following paid holidays: New Year&apos;s Day, Martin Luther King&apos;s Birthday, Presidents Day, Memorial Day, Juneteenth, Independence Day, Labor Day, Indigenous Day, Thanksgiving Day, Thanksgiving Friday (the day after Thanksgiving), Christmas Day, and either Christmas Eve or New Year&apos;s Eve (each employee&apos;s choice). An exempt employee who works on a paid holiday at CHA&apos;s request is granted flex-time equal to 1.5 times the hours worked that day; a non-exempt employee who does so is paid time-and-a-half for the hours worked. Each employee&apos;s exempt or non-exempt status is set on their profile by the Accounting Manager. Flex time is credited automatically when the timesheet is approved, appears as a separate Flex balance, and is used by requesting <strong>Flex Time</strong> leave; record holiday work on the holiday row of the timesheet. The Christmas Eve or New Year&apos;s Eve day is chosen by each employee under <strong>My Profile → Year-end paid holiday</strong> (changes lock on December 1).</p>
          </Section>

          <Section id="benefits" title="5. Benefits Summary">
            <p>CHA employees generally become eligible after <strong>90 days</strong> of employment for the following benefits, subject to the applicable plan documents for each benefit:</p>
            <Bullets items={[
              'Health insurance (medical, vision, and dental coverage options)',
              'Life insurance',
              'Long-term disability insurance',
              'Individual retirement account (with employer match)',
            ]} />
          </Section>

          <Section id="expenses" title="6. Procedure — Expense & Mileage Reimbursement">
            <p><strong className="text-[#0b2b35]">Eligible categories:</strong> Mileage, Hotel, Airline, Meals, Entertainment, Cash Advance, Tolls, Conference Fees, Rental Car, Gratuities, Parking, Other.</p>
            <p><strong className="text-[#0b2b35]">Mileage</strong> is reimbursed at the current rate per mile, set annually by the Accounting Manager. If a rate hasn&apos;t been set for the current year, flag it to the Accounting Manager rather than estimate.</p>
            <p><strong className="text-[#0b2b35]">Receipts</strong> are <strong>required for any expense over $75</strong> other than mileage — attach an image or PDF when you submit, and the portal won&apos;t accept the expense without it. At or under $75 a receipt is optional but should be attached whenever available, consistent with CHA&apos;s standard expense documentation practice.</p>
            <p><strong className="text-[#0b2b35]">Mileage documentation.</strong> Every mileage entry must include a <strong>description</strong> — where you drove and the business purpose. The Expenses page shows your total miles entered for the period you choose (current or previous pay period, this month, this year, or all time).</p>
            <p><strong className="text-[#0b2b35]">Approval.</strong> Submitted expenses route to the Accounting Manager/CEO for review, who are notified by email and in the portal, and show status Pending → Approved/Denied. You receive an email and a portal notification when an expense is decided, and a denied expense includes a reason where one was provided.</p>
          </Section>

          <Section id="payroll" title="7. Pay Periods & Pay Dates">
            <p>Pay periods run bi-weekly, Sunday through Saturday, and pay is deposited directly on the Tuesday 17 days after a period ends. The portal follows this schedule.</p>
            <Table
              head={['Item', 'Value']}
              rows={[
                ['Pay period cadence', 'Bi-weekly (14 days), Sunday through Saturday — per CHA&apos;s payroll schedule'],
                ['Pay period anchor / start date', 'Periods start 2026-09-13 and every 14 days after (2026-09-27, 2026-10-11, …), continuing through 2027 on the same cycle'],
                ['Timesheet submission cutoff', '2 calendar days after each period ends. One-time extension for the first period (09-13 – 09-26): due Friday 10-02-2026.'],
                ['Pay date', 'Direct deposit on the Tuesday 17 days after each period ends. CHA&apos;s schedule is confirmed through 2027-01-05; later dates follow the same cycle and may shift for bank holidays.'],
              ]}
            />
            <p className="font-semibold text-[#0b2b35] mt-4">Upcoming pay periods</p>
            <Table
              head={['Pay period', 'Timesheet due', 'Pay date']}
              rows={payCalendar.map(c => [fmtDateRange(c.start, c.end), fmtDate(c.timesheetDue), `${fmtDate(c.payDate)}${c.confirmed ? '' : ' (projected)'}`])}
            />
          </Section>

          <Section id="issues" title="8. Error, Discrepancy & Issue Reporting">
            <p>The portal has an in-app <strong className="text-[#0b2b35]">Report an Issue</strong> form (sidebar → Report an Issue) that notifies the Accounting Manager and admin team automatically, with reply-to set to you. A screenshot or file can be attached. Use it as the default reporting channel — the contacts in Section 2 still apply for anything that needs a named person directly, or if the form itself is unavailable.</p>
            <p><strong className="text-[#0b2b35]">During the 30-day parallel run</strong>, compare your portal timesheet and leave balances against CHA&apos;s existing system weekly and report any mismatch immediately rather than waiting.</p>
          </Section>

          <Section id="security" title="9. Account Security">
            <Bullets items={[
              <>Invite links are valid for <strong>48 hours</strong> from the time the invite is sent.</>,
              <>Password reset links are valid for <strong>48 hours</strong>.</>,
              <>You are signed out automatically after <strong>4 hours of inactivity</strong>; a warning appears a few minutes before.</>,
              <>The portal can only be used from <strong>Maryland, DC, Virginia, Pennsylvania and Delaware</strong> (based on the location of your internet connection). Signing in from elsewhere is blocked. If you will be traveling, or a mobile connection is being treated as outside the area, contact the System Administrator for temporary access.</>,
              <>Passwords must be at least <strong>8 characters</strong>.</>,
              'Credentials are personal and must not be shared; you’re individually responsible for the accuracy of entries and e-signatures made under your own login.',
            ]} />
          </Section>

          <Section id="effective" title="10. Effective Date">
            <p>September 23, 2026 (portal invite rollout). Status: parallel run — the portal is supplementary, not yet the system of record. This SOP will be reviewed at the end of the 30-day parallel run alongside the go/no-go cutover decision.</p>
          </Section>
        </div>
      </div>
    </div>
  )
}
