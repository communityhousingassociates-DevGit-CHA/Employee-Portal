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
  { id: 'roles', label: '2. Roles & Responsibilities' },
  { id: 'time-entry', label: '3. Time Entry' },
  { id: 'leave', label: '4. Leave Requests' },
  { id: 'expenses', label: '5. Expense & Mileage Reimbursement' },
  { id: 'approvals', label: '6. Approvals' },
  { id: 'payroll', label: '7. Payroll Cutoff & Pay Dates' },
  { id: 'issues', label: '8. Error, Discrepancy & Issue Reporting' },
  { id: 'security', label: '9. Account Security' },
  { id: 'effective', label: '10. Effective Date & Review' },
]

export default async function AdminSopPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !MANAGER_ROLES.includes(employee.role)) redirect('/dashboard')

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Admin & Leadership SOP</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Standard Operating Procedure — Time Entry, Leave Requests, Expense Reimbursement, Approvals &amp; Issue Reporting. September 22, 2026.
            {' '}See the companion <Link href="/sop" className="text-[#02ACC0] font-semibold hover:underline">Staff SOP</Link> for what applies to everyone else.
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
            <p>This is the expanded edition of the CHA Employee Portal SOP, for Carrileen Edwards and Nico Sanders — it includes the Approvals workflow and admin-only policy detail not in the general-staff edition. This SOP defines how Community Housing Associates (CHA) staff are expected to record time worked, request leave, submit reimbursable expenses, and report errors or discrepancies using the <strong className="text-[#0b2b35]">CHA Employee Portal</strong> (<code className="bg-[#f0f7f8] px-1.5 py-0.5 rounded text-[12px]">portal.communityhousingassociates.org</code>). It applies to every employee with a portal account, regardless of role.</p>
            <p>Step-by-step click-through instructions live in the portal itself — sidebar → <Link href="/guide" className="text-[#02ACC0] hover:underline">How-To Guide</Link> — this document sets the policy and procedure those steps must follow.</p>
            <p><strong className="text-[#0b2b35]">Current status:</strong> the portal is running in <strong>parallel</strong> with CHA&apos;s existing time and leave system for a trial period. It is not yet the system of record — staff should continue following existing CHA processes alongside portal use until leadership confirms cutover. This SOP will be updated at that point.</p>
          </Section>

          <Section id="roles" title="2. Roles & Responsibilities">
            <Table
              head={['Role', 'Portal role', 'Responsibilities']}
              rows={[
                ['All staff', 'employee', 'Log time each pay period, submit leave requests before taking time off, submit expenses/mileage with supporting detail, keep profile info current, report discrepancies promptly'],
                ['Accounting Manager — Carrileen Edwards (cedwards@communityhousingmd.org)', 'admin', 'Reviews and approves/denies leave requests, expenses, and timesheets (her own items route to the CEO, except during beta testing), sets the annual mileage rate, manages employee records via the Admin Console, first point of contact for pay/balance discrepancies'],
                ['President / CEO — Nico Sanders (nsanders@communityhousingmd.org)', 'ceo', 'Final approver in the workflow; approves/denies leave requests, expenses, and timesheets, and may approve his own items'],
                ['System Administrator', 'Globalist Pro (portal vendor)', 'Technical support: account provisioning, resets, bug fixes, system-level issues'],
              ]}
            />
            <p>An alternate/backup approver to cover Carrileen Edwards&apos;s absences has not yet been designated as of this writing — to be added once confirmed.</p>
          </Section>

          <Section id="time-entry" title="3. Procedure — Time Entry">
            <Numbered items={[
              <><strong className="text-[#0b2b35]">Pay period.</strong> Time is recorded on a <strong>bi-weekly</strong> (14-day) cycle, target 80 hours per period.</>,
              <><strong className="text-[#0b2b35]">Daily entry.</strong> Employees enter hours worked each day under Regular. Hourly employees enter Regular hours directly; salaried employees&apos; Regular hours are system-calculated as 8 minus Leave hours for each day. The Leave column cannot be typed in — it is filled automatically from approved leave requests (and automatically approved sick leave), so time off must be requested first. Scheduled holidays are filled in automatically as <strong>Holiday</strong> hours (instead of Regular). A timesheet with no leave is submitted for approval as normal; the portal blocks submission while the employee has a pending leave request in that pay period, so the leave is decided first.</>,
              <><strong className="text-[#0b2b35]">Save frequently.</strong> The system autosaves during entry; employees may also save manually at any point before submitting.</>,
              <><strong className="text-[#0b2b35]">Deadline.</strong> The timesheet for a pay period is due <strong>2 calendar days after the period ends</strong>. Employees are responsible for submitting on time. The Dashboard shows an automatic reminder starting 2 days before the cutoff (and again 1 day before) if the timesheet is still unsubmitted.</>,
              <><strong className="text-[#0b2b35]">Certification.</strong> Before submission, the employee must electronically sign, certifying the hours logged are accurate and complete.</>,
              <><strong className="text-[#0b2b35]">Submission.</strong> Once submitted, the timesheet is locked from further employee edits. Approvers are notified by email and in the portal and must approve it in the portal (Approvals → Timesheets). The employee is notified of the outcome by email and in the portal: if approved, the timesheet is marked <strong>Approved</strong>; if returned for correction, it unlocks with the approver&apos;s reason and the employee must resubmit. An approver cannot approve their own timesheet — another approver reviews it.</>,
              <><strong className="text-[#0b2b35]">Corrections after submission.</strong> Employees use <strong>Request a correction</strong> on a submitted or approved timesheet; approvers act on it under Approvals → Timesheets. See <em>Reopening timesheets</em> in Section 7.</>,
            ]} />
          </Section>

          <Section id="leave" title="4. Procedure — Leave Requests">
            <p><strong className="text-[#0b2b35]">Leave types.</strong> PTO, Sick Leave, and Vacation draw from the employee&apos;s leave balance. Bereavement and Jury Duty do not draw from any balance.</p>
            <p className="font-semibold text-[#0b2b35]">Submission</p>
            <Numbered items={[
              <>Leave should be requested through the portal <strong>as it happens</strong> — in advance where possible, otherwise the same day (illness) — so timesheets stay current. Dates up to <strong>14 days in the past</strong> can be entered to catch up; earlier dates are not accepted in the portal and must go through the Accounting Manager. Once accounting closes out a pay period, no further changes or requests are made for it.</>,
              'Leave is recorded in hourly increments; 8 hours = 1 full workday.',
              'Employees should check the Team Leave Calendar for overlapping team absences before submitting.',
              <>The request must be electronically signed by the employee before submission. An attachment is optional for every leave type except Jury Duty, where the summons is required — the portal blocks submission without it.</>,
              <>Submitted requests are status <strong>Pending</strong> until an approver acts in the portal; no leave should be taken on the assumption of approval until status changes to <strong>Approved</strong>. The employee receives an email and a portal notification when the request is approved or denied. <strong>Sick leave</strong> needs no approval as long as the employee has enough sick balance: it is approved automatically at submission (balance deducted, days posted to the timesheet, employee notified) and never enters the Approvals queue. A sick request that exceeds the available balance is treated as a negative balance and routed to an approver.</>,
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
              <>A request that would take a balance negative is allowed but flagged for manager approval. An individual exception to the 400-hour cap can be granted at CEO discretion — flagged per employee via the &ldquo;PTO Uncapped&rdquo; toggle in the Admin Console (Users → Edit Employee). Currently applied to Nico Sanders (CEO) only. This exception is intentionally left out of the Staff SOP.</>,
            ]} />
          </Section>

          <Section id="expenses" title="5. Procedure — Expense & Mileage Reimbursement">
            <p><strong className="text-[#0b2b35]">Eligible categories:</strong> Mileage, Hotel, Airline, Meals, Entertainment, Cash Advance, Tolls, Conference Fees, Rental Car, Gratuities, Parking, Other.</p>
            <p><strong className="text-[#0b2b35]">Mileage</strong> is reimbursed at the current rate per mile, set annually by the Accounting Manager or Admin in Portal Settings. If a rate hasn&apos;t been set for the current year, mileage expenses cannot be calculated until one is added — employees should flag this to the Accounting Manager rather than estimate.</p>
            <p><strong className="text-[#0b2b35]">Receipts</strong> are optional in the system but should be attached (image or PDF) whenever available, consistent with CHA&apos;s standard expense documentation practice.</p>
            <p><strong className="text-[#0b2b35]">Approval.</strong> Submitted expenses route to the Accounting Manager/CEO Approvals queue, the same as leave requests, and show status Pending → Approved/Denied. The employee receives an email and a portal notification when an expense is decided, and a denied expense includes a reason where one was provided.</p>
          </Section>

          <Section id="approvals" title="6. Procedure — Approvals">
            <p><strong>Approvers:</strong> the Accounting Manager (Carrileen Edwards) and the President/CEO (Nico Sanders) approve or deny leave requests, expenses, and timesheets. <strong>Self-approval:</strong> the Accounting Manager may not approve her own items — they route to the President/CEO. The President/CEO may approve his own items until leadership states otherwise. <strong>During beta testing</strong>, both may approve their own items so the full workflow can be tested; this beta allowance ends when leadership says so. This policy is set by CHA and changes only when leadership changes it.</p>
            <Numbered items={[
              <><strong>Notification and action.</strong> Every submitted leave request, expense, and timesheet sends an email alert to the approvers (the Accounting Manager, CEO, and Admin — never the person who submitted it) and appears in their portal bell, Dashboard banner, and <strong>Approvals</strong> queue. The email is an alert only: the approval or denial must be recorded in the portal, and replying to the email does not count as a decision.</>,
              <><strong>Approving a leave request</strong> automatically deducts the requested hours from the employee&apos;s balance and logs the approved day(s) as Leave on their timesheet — no separate manual entry is needed.</>,
              <><strong>Denying</strong> a request should include a reason so the employee understands the decision; the reason is included in the employee&apos;s email and portal notification and is visible in their History. The employee is notified by email and in the portal of every approval and denial.</>,
              <><strong>Expense approvals/denials</strong> work the same way, on a separate queue from leave.</>,
              <><strong>Timesheets</strong> are reviewed in the <strong>Timesheets</strong> tab: <strong>Approve</strong> marks the timesheet Approved; <strong>Return for correction</strong> (a reason is required) unlocks it so the employee can fix and resubmit. The employee is notified either way. The same self-approval rules apply as for leave requests and expenses.</>,
              <>Decisions are final once confirmed — there is no un-approve/un-deny function. Approvers should verify details before confirming. Issue reports (from Report an Issue) follow their own workflow on the Issue Reports page: Open → Reviewed → Fixed, with an optional note recorded when something is marked Fixed describing what was done.</>,
            ]} />
          </Section>

          <Section id="payroll" title="7. Payroll Cutoff & Pay Dates">
            <p>Pay period cadence, anchor, and the timesheet submission cutoff are confirmed below (2026-09-22). Payroll processing cutoff and pay date(s) remain pending.</p>
            <Table
              head={['Item', 'Value']}
              rows={[
                ['Pay period cadence', 'Bi-weekly (14 days) — confirmed'],
                ['Pay period anchor / start date', 'Confirmed 2026-09-22: periods start 2026-01-14 and every 14 days after (e.g. 2026-09-09, 2026-09-23, 2026-10-07, …)'],
                ['Timesheet submission cutoff', '2 calendar days after each period ends — confirmed.'],
                ['Payroll processing cutoff', '12 calendar days after each period ends — PROVISIONAL, pending confirmation of CHA&apos;s payroll schedule (e.g. payroll for the period ending 2026-09-12 was due 2026-09-24)'],
                ['Pay date(s)', 'TBD — pending CHA&apos;s payroll schedule (direct deposit for the period ending 2026-09-12 is 2026-09-29)'],
              ]}
            />
            <p className="font-semibold text-[#0b2b35] mt-4">Reopening timesheets</p>
            <p>Timesheets lock at submission. The payroll due date (provisionally 12 days after period end) is the hard lock. Every reopen — including a return for correction — requires a <strong>reason code and written notes</strong> and is recorded in the timesheet&apos;s history (who, when, why).</p>
            <Table
              head={['Stage', 'Reopen?', 'Who', 'Rule']}
              rows={[
                ['Submitted, not yet approved', 'Yes', 'Any approver — Return for correction', 'Reason code + notes; employee fixes and resubmits.'],
                ['Approved, before payroll is due', 'Yes', 'Any approver — Reopen', 'Reason code + notes; goes back to draft and needs re-approval.'],
                ['After payroll is due', 'Only by override', 'CEO only — CEO override', 'Reason code + notes; logged as a post-payroll adjustment; needs re-approval.'],
              ]}
            />
            <p><strong>Reason codes:</strong> Employee error · Approver error · Leave added or changed · Payroll / accounting discrepancy · Post-payroll adjustment (CEO override) · Other. Employees may ask for a correction in the portal; approvers see it flagged under Approvals → Timesheets → Approved.</p>
            <p><strong>Late leave:</strong> if leave is approved (or sick leave auto-approved) for dates on a timesheet that is already submitted or approved, and payroll is not yet due, that timesheet is reopened automatically (reason: leave added) and must be re-approved. If payroll is already due, the timesheet is left unchanged and the CEO is alerted; the leave still counts against the balance, and the CEO can use the override if pay must be adjusted.</p>
            <p>This section will be updated once CHA provides the confirmed bi-weekly cycle anchor date and pay dates. Until then, employees should continue to follow CHA&apos;s existing payroll calendar for actual pay timing.</p>
          </Section>

          <Section id="issues" title="8. Error, Discrepancy & Issue Reporting">
            <p>The portal has an in-app Report an Issue form (sidebar → Report an Issue) that emails communityhousingassociates@gmail.com, cc advisor@globalist.pro, with reply-to set to the reporting employee. A screenshot or file can be attached to the report. Employees should use it as the default reporting channel. The category-specific contacts below still apply for anything that needs a named person directly, or if the form itself is unavailable:</p>
            <Table
              head={['Issue type', 'Report to', 'Examples']}
              rows={[
                ['Account / login trouble', 'System Administrator (Globalist Pro)', "Invite or reset link expired, can't sign in, locked out"],
                ['Pay, balance, or timesheet discrepancy', 'Accounting Manager — Carrileen Edwards (cedwards@communityhousingmd.org)', "Hours don't match, leave balance looks wrong, approved leave didn't post to the timesheet"],
                ['Something appears broken (not a data issue)', "Accounting Manager, who escalates to Globalist Pro if it's a system bug", "Page won't load, a button doesn't work, an export is malformed"],
              ]}
            />
            <p><strong className="text-[#0b2b35]">During the 30-day parallel run</strong>, staff should compare their portal timesheet and leave balances against CHA&apos;s existing system weekly and report any mismatch immediately rather than waiting — discrepancies are tracked and must be resolved before cutover.</p>
            <p><strong className="text-[#0b2b35]">Ownership:</strong> confirmed 2026-09-22 — weekly discrepancy triage is handled jointly by Globalist Pro and Carrileen Edwards (Accounting Manager).</p>
          </Section>

          <Section id="security" title="9. Account Security">
            <Bullets items={[
              <>Invite links are valid for <strong>24 hours</strong> from the time the invite is sent.</>,
              <>Password reset links are valid for <strong>24 hours</strong>.</>,
              <>Passwords must be at least <strong>8 characters</strong>.</>,
              'Credentials are personal and must not be shared; each employee is individually responsible for the accuracy of entries and e-signatures made under their own login.',
            ]} />
          </Section>

          <Section id="effective" title="10. Effective Date & Review">
            <Table
              head={['', '']}
              rows={[
                ['Effective date', 'September 23, 2026 (portal invite rollout)'],
                ['Status', 'Parallel run — portal is supplementary, not yet the system of record'],
                ['Next review', 'At end of the 30-day parallel run, alongside the go/no-go cutover decision'],
                ['Document owner', 'Accounting Manager (Carrileen Edwards), with Globalist Pro maintaining the portal itself'],
              ]}
            />
            <p>This SOP should be revisited once Section 7 (Payroll Cutoff &amp; Pay Dates) is finalized, once the parallel-run discrepancy-triage owner (Section 8) is confirmed, and again at cutover, when parallel-run language throughout this document should be removed.</p>
          </Section>
        </div>
      </div>
    </div>
  )
}
