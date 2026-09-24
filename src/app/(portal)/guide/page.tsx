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

function Steps({ items }: { items: React.ReactNode[] }) {
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

const TOC = [
  { id: 'getting-started', label: '1. Getting Started' },
  { id: 'dashboard', label: '2. Your Dashboard' },
  { id: 'timesheet', label: '3. Logging Your Time' },
  { id: 'leave', label: '4. Requesting Leave' },
  { id: 'history', label: '5. Request History' },
  { id: 'calendar', label: '6. Team Leave Calendar' },
  { id: 'expenses', label: '7. Expenses & Mileage' },
  { id: 'profile', label: '8. Your Profile' },
  { id: 'approvers', label: '9. For Approvers', managerOnly: true },
  { id: 'help', label: '10. Getting Help' },
]

export default async function GuidePage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')
  const isManager = MANAGER_ROLES.includes(employee.role)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">How-To Guide</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Day-to-day walkthrough of the Employee Portal. For policy and procedure (accrual rates, cutoffs, caps), see the{' '}
            <Link href="/dashboard" className="text-[#02ACC0] font-semibold hover:underline">Documentation</Link> card on your Dashboard.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6 items-start">
        <nav className="bg-white rounded-xl border border-[#d4eef2] p-4 lg:sticky lg:top-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">On this page</p>
          <div className="flex flex-col gap-0.5">
            {TOC.filter(t => !t.managerOnly || isManager).map(t => (
              <a key={t.id} href={`#${t.id}`} className="text-[12px] text-gray-600 hover:text-[#02ACC0] py-1 transition-colors">{t.label}</a>
            ))}
          </div>
        </nav>

        <div className="space-y-5">
          <Section id="getting-started" title="1. Getting Started">
            <p><strong className="text-[#0b2b35]">Your invite email.</strong> You&apos;ll receive an email inviting you to set up your portal account. The link is valid for <strong>24 hours</strong> — open it and set a password as soon as you can. If it expires, ask your administrator to resend the invite.</p>
            <p className="font-semibold text-[#0b2b35]">Setting your password</p>
            <Steps items={[
              'Click the link in the invite email.',
              'Enter a password (minimum 8 characters) and confirm it.',
              <>Click <strong>Set Password &amp; Continue</strong> — you&apos;ll be signed in and taken straight to your Dashboard.</>,
            ]} />
            <p><strong className="text-[#0b2b35]">Signing in later.</strong> Go to <code className="bg-[#f0f7f8] px-1.5 py-0.5 rounded text-[12px]">portal.communityhousingassociates.org</code> and sign in with your CHA email address and password.</p>
            <p className="font-semibold text-[#0b2b35]">Forgot your password?</p>
            <Steps items={[
              <>On the sign-in screen, click <strong>Forgot password?</strong></>,
              <>Enter your CHA email address and click <strong>Send Reset Link</strong>.</>,
              <>Check your email — the reset link is valid for <strong>24 hours</strong>. If it expires, just request a new one.</>,
            ]} />
            <p><strong className="text-[#0b2b35]">Trouble signing in?</strong> Contact your administrator — see <a href="#help" className="text-[#02ACC0] hover:underline">Getting Help</a> below.</p>
          </Section>

          <Section id="dashboard" title="2. Your Dashboard">
            <p>Your Dashboard is the first thing you see after signing in. It shows:</p>
            <Bullets items={[
              <><strong className="text-[#0b2b35]">PTO / Sick / Vacation Days balance cards</strong> — current hours available, roughly how many working days that is, and your accrual rate per pay period.</>,
              <><strong className="text-[#0b2b35]">Pay period progress bar</strong> — where you are in the current bi-weekly pay period.</>,
              <><strong className="text-[#0b2b35]">Recent Leave Requests</strong> — your last few requests and their status, with a link to submit a new one.</>,
              <><strong className="text-[#0b2b35]">Timesheet card</strong> — hours logged so far out of the 80-hour target. If the cutoff is 1–2 days away and it&apos;s still unsubmitted, a red reminder banner appears above until you submit it.</>,
              <><strong className="text-[#0b2b35]">Upcoming Leave</strong> — your next approved time off.</>,
              <><strong className="text-[#0b2b35]">Quick links</strong> — My Request History, Team Leave Calendar, My Expenses (and Pending Approvals, if you&apos;re an approver).</>,
            ]} />
            <p>If you&apos;re an Accounting Manager, CEO, or Admin, an amber banner appears at the top whenever items are waiting on your review — leave requests, expenses, or timesheets. You also receive an email alert for each new submission you need to review.</p>
          </Section>

          <Section id="timesheet" title="3. Logging Your Time (Timesheet)">
            <p>Go to <strong>Timesheet</strong> from the Dashboard or the sidebar.</p>
            <p><strong className="text-[#0b2b35]">Layout.</strong> Each pay period is a two-week grid, one row per day, with columns for Date, Description/Project, Regular hours, Leave hours, and that day&apos;s Total. The target for a full period is <strong>80 hours</strong>.</p>
            <p className="font-semibold text-[#0b2b35]">Entering hours</p>
            <Bullets items={[
              <>Hourly employees enter <strong>Regular</strong> hours directly for each day worked.</>,
              <>Salaried employees don&apos;t enter Regular directly — it&apos;s calculated automatically as <strong>8 minus Leave</strong> for each day.</>,
              <>The <strong>Leave</strong> column can&apos;t be typed in — it fills in automatically from your leave requests (see section 4). To take time off, submit a leave request first; a timesheet with no leave submits as normal. If a leave request in the pay period is still pending, get it decided before you submit.</>,
              <>Scheduled holidays fill in automatically as <strong>Holiday</strong> hours (a rose tag) instead of Regular, so holiday time is tracked separately. You can&apos;t edit that column either.</>,
              'Add a short description for each day worked.',
              <>A day showing an amber <strong>Incomplete</strong> tag has less than a full day logged; a day tagged <strong>Leave</strong> has hours logged in the Leave column.</>,
            ]} />
            <p><strong className="text-[#0b2b35]">Saving.</strong> Edits autosave a couple of seconds after you stop typing. You can also click <strong>Save Now</strong> to save immediately.</p>
            <p><strong className="text-[#0b2b35]">Due date.</strong> Each period&apos;s timesheet is due <strong>2 days after the pay period ends</strong>.</p>
            <p className="font-semibold text-[#0b2b35]">Submitting</p>
            <Steps items={[
              'Review your Regular, Leave, and Total columns for the full two weeks.',
              'Click inside the signature box and sign your name to certify the hours are accurate.',
              <>Click <strong>Submit &amp; Sign</strong>.</>,
            ]} />
            <p>Once submitted, the timesheet <strong>locks</strong> — you can&apos;t edit it yourself after that. Your approver is notified by email and in the portal. When they review it you&apos;re notified the same way (the 🔔 in the top bar): it shows as <strong>Approved</strong>, or it&apos;s <strong>returned for correction</strong> with their reason at the top of the timesheet — fix it and submit again. Spotted a mistake after submitting? Click <strong>Request a correction</strong> on the timesheet and say what needs fixing — your approver reopens it and you resubmit. (Once payroll is due for that period, only the CEO can reopen it, so tell us promptly.)</p>
            <p><strong className="text-[#0b2b35]">Exporting.</strong> Use <strong>Export CSV</strong> or <strong>Export PDF</strong> at any time to download or print the current period&apos;s timesheet.</p>
          </Section>

          <Section id="leave" title="4. Requesting Leave">
            <p>Go to <strong>Request Leave</strong> from the Dashboard or sidebar.</p>
            <p className="font-semibold text-[#0b2b35]">1. Choose a leave type</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-[#f0f7f8]"><th className="text-left py-1.5 font-semibold text-[#0b2b35]">Type</th><th className="text-left py-1.5 font-semibold text-[#0b2b35]">Draws from balance?</th><th className="text-left py-1.5 font-semibold text-[#0b2b35]">Needs approval?</th></tr></thead>
                <tbody>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🌴 PTO</td><td className="py-1.5">Yes</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🤒 Sick Leave</td><td className="py-1.5">Yes</td><td className="py-1.5">No — automatic if your balance covers it</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🗓 Vacation</td><td className="py-1.5">Yes</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🕊 Bereavement</td><td className="py-1.5">No</td><td className="py-1.5">Yes</td></tr>
                  <tr><td className="py-1.5">⚖️ Jury Duty</td><td className="py-1.5">No</td><td className="py-1.5">Yes</td></tr>
                </tbody>
              </table>
            </div>
            <Bullets items={[
              <><strong>2. Pick your dates and hours.</strong> Enter a start and end date, then type in total hours or click <strong>Auto-fill</strong> (it skips weekends and scheduled holidays). 8 hours = 1 full day. You can enter dates up to <strong>14 days back</strong> to catch up, so try to request leave as it happens.</>,
              <><strong>3. Check the Balance Preview.</strong> Shows your current balance, what this request subtracts, and what would remain. A negative result still allows submission, flagged for manager approval.</>,
              <><strong>4. Check Team Coverage.</strong> Shows if anyone else already has leave overlapping your dates — informational, doesn&apos;t block your request.</>,
              <><strong>5. Add a note</strong> (optional) for your approver. Attach a file if you have one — <strong>required for Jury Duty</strong> (the summons), optional for every other type — then sign in the signature box.</>,
              <><strong>6. Click Submit Request.</strong> Your approvers are notified by email and in the portal, and your request shows as <strong>Pending</strong> until they decide. You&apos;ll get an email and a 🔔 notification when it&apos;s approved or denied.</>,
            ]} />
          </Section>

          <Section id="history" title="5. Checking Your Request History">
            <p>Go to <strong>My Request History</strong> to see every leave request you&apos;ve submitted, with summary counts for Total, Approved, Pending, and Hours Approved.</p>
            <Bullets items={[
              'Filter by status (All / Pending / Approved / Denied) or by leave type.',
              'Click any row with a note icon to expand it and see your note, or — if denied — the reason given.',
            ]} />
          </Section>

          <Section id="calendar" title="6. Team Leave Calendar">
            <p>Go to <strong>Team Leave Calendar</strong> for a month view of who&apos;s out, color-coded by leave type, plus federal holidays. Your own leave is highlighted separately.</p>
            <p>Check this before submitting a request — the sidebar also lists <strong>Upcoming Leave</strong> for the whole team and <strong>My Scheduled Leave</strong> for just you.</p>
          </Section>

          <Section id="expenses" title="7. Submitting Expenses & Mileage">
            <p>Go to <strong>Expenses</strong> and click <strong>+ New Expense</strong>.</p>
            <Bullets items={[
              <><strong>1. Pick a category:</strong> Mileage, Hotel, Airline, Meals, Entertainment, Cash Advance, Tolls, Conference Fees, Rental Car, Gratuities, Parking, or Other.</>,
              <><strong>2. Enter the amount.</strong> For Mileage, enter miles driven — reimbursement is calculated automatically from the current rate per mile. Every other category, enter the dollar amount directly.</>,
              <><strong>3. Add a description</strong> and, optionally, attach a receipt (image or PDF).</>,
              <><strong>4. Click Submit Expense.</strong> Status updates from Pending to Approved/Denied; view an attached receipt any time from the Receipt column.</>,
            ]} />
          </Section>

          <Section id="profile" title="8. Your Profile">
            <p>Go to <strong>Profile</strong> to update your photo, name, job title, and department. There&apos;s also a <strong>Security</strong> section where you can change your password at any time.</p>
          </Section>

          {isManager && (
            <Section id="approvers" title="9. For Approvers (Accounting Manager, CEO, Admin)">
              <p><strong>Approvals</strong> appears in your sidebar, and a banner appears on your Dashboard whenever items are waiting.</p>
              <p>Every new item you need to review sends you an email alert and shows in the 🔔 in the top bar. Approving or denying must be done here in the portal — replying to the email isn&apos;t enough.</p>
              <p><strong>Your own items:</strong> the Accounting Manager can&apos;t approve her own leave requests, expenses, or timesheets — they go to the President/CEO. The President/CEO can approve his own. (During beta testing, both can approve their own.)</p>
              <p>The Approvals page has three tabs — <strong>Leave Requests</strong>, <strong>Expenses</strong>, and <strong>Timesheets</strong>. Leave Requests is split into Pending and Reviewed.</p>
              <p className="font-semibold text-[#0b2b35]">Reviewing a leave request</p>
              <Bullets items={[
                'Each card shows the employee, leave type, date range, hours requested, balance after the request, any note, and a link to view any attachment — including the required summons on a Jury Duty request.',
                <>Click <strong>✓ Approve</strong>, then <strong>Confirm &amp; Sign</strong> — deducts the balance and logs the approved day(s) as Leave on the timesheet automatically.</>,
                <>Click <strong>Deny</strong>, optionally add a reason, then <strong>Confirm Denial</strong>.</>,
              ]} />
              <p><strong className="text-[#0b2b35]">Reviewing an expense</strong> works the same way, in the Expenses tab.</p>
              <p><strong className="text-[#0b2b35]">Reviewing a timesheet:</strong> open the Timesheets tab, use <strong>Show daily entries</strong> to check the hours, then click <strong>✓ Approve</strong>, or <strong>Return for correction</strong> with a reason code and notes (both required) to unlock it for the employee. To fix an already-approved timesheet, use the <strong>Approved</strong> tab → <strong>Reopen for correction</strong>; after payroll is due only the CEO sees the <strong>CEO override</strong> button. Employee correction requests are flagged there, and every reopen is recorded in the timesheet&apos;s <strong>History</strong>.</p>
              <p>The employee is emailed and notified in the portal of every approval, denial, or return.</p>
              <p>Decisions are final once confirmed. Issue reports (from Report an Issue) follow their own workflow on the Issue Reports page: Open → Reviewed → Fixed, with an optional note when marked Fixed.</p>
            </Section>
          )}

          <Section id="help" title="10. Getting Help">
            <p>Go to <strong>Report an Issue</strong> in the sidebar to send a report from inside the portal — it notifies the Accounting Manager and admin team automatically, and replies come straight back to you. Attach a screenshot if it helps.</p>
            <p>You can also reach out directly:</p>
            <Bullets items={[
              <><strong className="text-[#0b2b35]">Can&apos;t sign in, or your invite/reset link expired</strong> — contact your system administrator.</>,
              <><strong className="text-[#0b2b35]">A balance, timesheet, or pay figure looks wrong</strong> — report it to your Accounting Manager.</>,
              <><strong className="text-[#0b2b35]">Anything else that seems broken</strong> — report it the same way; it&apos;ll get logged and routed.</>,
            ]} />
          </Section>
        </div>
      </div>
    </div>
  )
}
