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

function Figure({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="my-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full max-w-[720px] rounded-lg border border-[#d4eef2] shadow-sm" loading="lazy" />
      <figcaption className="text-[11px] text-gray-400 mt-1.5">{caption}</figcaption>
    </figure>
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
            <p><strong className="text-[#0b2b35]">Your invite email.</strong> You&apos;ll receive an email inviting you to set up your portal account. The link is valid for <strong>48 hours</strong> — open it and set a password as soon as you can. If it expires, ask your administrator to resend the invite.</p>
            <p className="font-semibold text-[#0b2b35]">Setting your password</p>
            <Steps items={[
              'Click the link in the invite email.',
              'Enter a password (minimum 8 characters) and confirm it.',
              <>Click <strong>Set Password &amp; Continue</strong> — you&apos;ll be signed in and taken straight to your Dashboard.</>,
            ]} />
            <p><strong className="text-[#0b2b35]">Signing in later.</strong> Go to <code className="bg-[#f0f7f8] px-1.5 py-0.5 rounded text-[12px]">portal.communityhousingassociates.org</code> and sign in with your CHA email address and password.</p>
            <p><strong className="text-[#0b2b35]">Security.</strong> You&apos;re signed out automatically after <strong>4 hours of inactivity</strong> (you&apos;ll see a warning first — click <em>Stay signed in</em> to continue). The portal can only be used from Maryland, DC, Virginia, Pennsylvania and Delaware; if you&apos;re traveling, ask your system administrator for temporary access before you go.</p>
            <p className="font-semibold text-[#0b2b35]">Forgot your password?</p>
            <Steps items={[
              <>On the sign-in screen, click <strong>Forgot password?</strong></>,
              <>Enter your CHA email address and click <strong>Send Reset Link</strong>.</>,
              <>Check your email — the reset link is valid for <strong>48 hours</strong>. If it expires, just request a new one.</>,
            ]} />
            <p><strong className="text-[#0b2b35]">Trouble signing in?</strong> Contact your administrator — see <a href="#help" className="text-[#02ACC0] hover:underline">Getting Help</a> below.</p>
          </Section>

          <Section id="dashboard" title="2. Your Dashboard">
            <p>Your Dashboard is the first thing you see after signing in. It shows:</p>
            <Bullets items={[
              <><strong className="text-[#0b2b35]">PTO / Sick / Personal Days balance cards</strong> (plus Flex time if you have earned some) — current hours available, roughly how many working days that is, and your accrual rate per pay period.</>,
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
              <>Scheduled holidays fill in automatically as <strong>Holiday</strong> hours instead of Regular, with the description set to “Holiday Hours”, so holiday time is tracked separately. You can&apos;t edit that column either.</>,
              <><strong>Working a holiday.</strong> If CHA asks you to work a paid holiday, the holiday row shows a small <strong>Worked this holiday at CHA&apos;s request</strong> box — enter the hours you worked. When the timesheet is approved, exempt employees are credited flex time (1.5 × those hours); for non-exempt employees payroll pays time-and-a-half.</>,
              <>Your <strong>Christmas Eve or New Year&apos;s Eve</strong> holiday is your choice — set it under <strong>My Profile → Year-end paid holiday</strong> (changes lock December 1). It appears as a holiday on timesheets created after you choose.</>,
              <>Need time off on a day? Click <strong>+ Leave</strong> under the date to request it — approved leave then fills in the Leave column.</>,
              'Add a short description for each day worked.',
              <>The <strong>Tags</strong> column flags each day automatically — hover a tag for detail: <strong>Holiday</strong>, <strong>Holiday worked</strong> (hours logged on a holiday), the type of leave taken (<strong>PTO</strong>, <strong>Sick</strong>, <strong>Personal Days</strong>…), <strong>Incomplete</strong> (no hours), <strong>Over 8 hrs</strong>, <strong>Short day</strong> (full-time staff under 8 hours with no leave), and <strong>Overtime</strong> (regular hours past 40 in a week). Next to the pay period you may also see tags for the whole timesheet, such as <strong>Reopened</strong>, <strong>Correction requested</strong>, <strong>Leave added late</strong>, or <strong>Closed by accounting</strong>. Those automatic tags follow your hours and can&apos;t be edited. You can also add your own from the company&apos;s tag list — click <strong>+ Tag</strong> on a day and choose one (for example a grant or program); click the × on a tag to remove it. Your own tags save with the rest of the timesheet and can be changed until you submit. Everything appears in the CSV export and in what your approver sees.</>,
            ]} />
            <Figure src="/guide/timesheet-add-leave.png" alt="Timesheet days with a + Leave link under each date" caption="Click “+ Leave” under a day to open the leave request form with that day already selected." />
            <Figure src="/guide/holiday-worked.png" alt="A holiday row with the Worked this holiday at CHA's request box" caption="On a paid holiday, enter the hours you worked at CHA's request. The day is tagged “Holiday worked”." />
            <Figure src="/guide/year-end-holiday.png" alt="The Year-end paid holiday choice on My Profile" caption="Choose Christmas Eve or New Year's Eve under My Profile → Year-end paid holiday." />
            <p><strong className="text-[#0b2b35]">Saving.</strong> Edits autosave a couple of seconds after you stop typing. You can also click <strong>Save Now</strong> to save immediately.</p>
            <p><strong className="text-[#0b2b35]">Due date.</strong> Each period&apos;s timesheet is due <strong>2 days after the pay period ends</strong>.</p>
            <p className="font-semibold text-[#0b2b35]">Submitting</p>
            <Steps items={[
              'Review your Regular, Leave, and Total columns for the full two weeks.',
              'Click inside the signature box and sign your name to certify the hours are accurate.',
              <>Click <strong>Submit &amp; Sign</strong>.</>,
            ]} />
            <p>Once submitted, the timesheet <strong>locks</strong> — you can&apos;t edit it yourself after that. Your approver is notified by email and in the portal. When they review it you&apos;re notified the same way (the 🔔 in the top bar): it shows as <strong>Approved</strong>, or it&apos;s <strong>returned for correction</strong> with their reason at the top of the timesheet — fix it and submit again. Spotted a mistake after submitting? Click <strong>Request a correction</strong> on the timesheet and say what needs fixing — your approver reopens it and you resubmit. (Once accounting has closed that period, only the CEO can reopen it, so tell us promptly.)</p>
            <p><strong className="text-[#0b2b35]">Exporting.</strong> Use <strong>Export CSV</strong> or <strong>Export PDF</strong> at any time to download or print the current period&apos;s timesheet.</p>
          </Section>

          <Section id="leave" title="4. Requesting Leave">
            <p>Go to <strong>Request/Use Leave</strong> from the Dashboard or sidebar — you use it both to ask for leave that needs approval and to record leave that doesn&apos;t (sick leave within your balance).</p>
            <p className="font-semibold text-[#0b2b35]">1. Choose a leave type</p>
            <Figure src="/guide/leave-types.png" alt="The leave type cards on Request/Use Leave" caption="Pick a leave type. Balances show on the cards that draw from one; Flex Time appears once you have earned some." />
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-[#f0f7f8]"><th className="text-left py-1.5 font-semibold text-[#0b2b35]">Type</th><th className="text-left py-1.5 font-semibold text-[#0b2b35]">Draws from balance?</th><th className="text-left py-1.5 font-semibold text-[#0b2b35]">Needs approval?</th></tr></thead>
                <tbody>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🌴 PTO</td><td className="py-1.5">Yes</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🤒 Sick Leave</td><td className="py-1.5">Yes</td><td className="py-1.5">No — automatic if your balance covers it</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🗓 Personal Days</td><td className="py-1.5">Yes</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🕊 Bereavement</td><td className="py-1.5">No</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">⚖️ Jury Duty</td><td className="py-1.5">No</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🗳 Election Voting</td><td className="py-1.5">No</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🩹 Workers&apos; Comp</td><td className="py-1.5">No</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">🎖 Military Service</td><td className="py-1.5">No</td><td className="py-1.5">Yes</td></tr>
                  <tr className="border-b border-[#f0f7f8]"><td className="py-1.5">⏸ Unpaid Leave</td><td className="py-1.5">No</td><td className="py-1.5">Yes</td></tr>
                  <tr><td className="py-1.5">⏱ Flex Time</td><td className="py-1.5">Yes — your flex balance (only shown once you&apos;ve earned some)</td><td className="py-1.5">Yes</td></tr>
                </tbody>
              </table>
            </div>
            <p className="font-semibold text-[#0b2b35]">About the newer leave types</p>
            <Bullets items={[
              <><strong>Election Voting.</strong> Request it like any other leave — it is <em>not</em> typed into the timesheet. It is <strong>4 hours</strong> by default, for a single day. If the distance between your home and work prevents you from voting outside working hours, choose <strong>Extra +2</strong> to ask for up to <strong>6 hours</strong>: the extra 2 hours need your manager&apos;s approval, and your approver will see the request flagged so they can check it against the policy. Once approved, the hours appear in the Leave column and (for salaried staff) Regular is reduced to match.</>,
              <><strong>Workers&apos; Comp.</strong> For an on-the-job injury covered by Maryland&apos;s workers&apos; compensation law that doesn&apos;t pay disability benefits for the first 3 days — those 3 days are paid leave, up to 24 hours in one request.</>,
              <><strong>Military Service.</strong> Paid leave CHA provides where the law requires it. Your approver reviews each request.</>,
              <><strong>Flex Time.</strong> Exempt employees who work a paid holiday at CHA&apos;s request earn flex time equal to 1.5 × the hours worked (see “Working a holiday” in section 3). Request it here like other leave; the card only appears once you have a flex balance. Non-exempt employees are paid time-and-a-half for holiday hours instead.</>,
              <><strong>Unpaid Leave.</strong> Time off without pay. It uses no leave balance and needs approval like other leave; once approved the hours appear in the Leave column tagged <strong>Unpaid</strong>, and payroll sees them broken out. If you would rather be paid, use PTO or Personal Days instead.</>,
              <><strong>Personal Days</strong> are 24 hours (3 days), added each January 1. <strong>PTO</strong> means annual leave. Unused PTO, Personal Days and sick leave carry over into the new year up to a combined limit — 240 hours, or 400 hours once you have 60 months of service.</>,
              <><strong>Waiting periods.</strong> PTO and sick leave can&apos;t be taken until you&apos;ve been employed 90 days, and Personal Days not until 6 months (exceptions only by the President and CEO). CHA asks for PTO to be requested at least a week ahead; the form warns you when a request is shorter notice.</>,
            ]} />
            <Figure src="/guide/voting-hours.png" alt="Election Voting hours with Standard and Extra +2 buttons" caption="Election Voting starts at 4 hours. Choose “Extra +2” to ask for 6 hours — your approver reviews the extra time." />
            <p className="font-semibold text-[#0b2b35]">Steps</p>
            <Bullets items={[
              <><strong>Shortcut:</strong> on your timesheet, click <strong>+ Leave</strong> under any day to open this form with that day already selected.</>,
              <><strong>2. Pick your days and hours.</strong> The days work like your timesheet: a grid of workdays for a pay period (use <strong>Prev / Next</strong> to move between periods). Tick each day you&apos;ll be out — it starts at 8 hours (a full day); change it to 4 for a half day, or use the Full / Half buttons. <strong>Select full week</strong> ticks Monday–Friday at once. Everything you pick is sent as <strong>one request</strong>: your approver sees each day listed with its hours and approves or denies them together, and cancelling cancels the whole request. Weekends, holidays and closed periods can&apos;t be picked. No day can hold more than 8 hours of leave in total — counting every pending and approved request of any type — so the form blocks Submit if a day would go over. Planned leave (PTO, Personal Days, Bereavement, Jury Duty, Election Voting, Workers&apos; Comp, Military) can be booked as far ahead as you like — <strong>Sick leave</strong> for a foreseeable need, like a planned appointment, can be booked ahead too (give at least 7 days&apos; notice when you know that far in advance). You can also enter dates up to <strong>14 days back</strong> to catch up. To mix leave types, submit one request per type.</>,
              <><strong>3. Check the Balance Preview.</strong> Shows your current balance, what this request subtracts, and what would remain. For a future date it shows your <strong>projected</strong> balance on that day (accruals expected by then, minus other approved future leave). Leave starting within the next two pay periods comes off your balance as soon as it is approved. Leave planned further out is <strong>reserved</strong> when approved and comes off once it is within two pay periods of the start date — the projected hours must actually be available then for the leave to be valid. Your Dashboard lists anything reserved.</>,
              <><strong>4. Check Team Coverage.</strong> Shows if anyone else already has leave overlapping your dates — informational, doesn&apos;t block your request.</>,
              <><strong>5. Add a note</strong> (optional) for your approver. Attach a file if you have one — <strong>required for Jury Duty</strong> (the summons), optional for every other type — then sign in the signature box.</>,
              <><strong>6. Click Submit Request.</strong> Your approvers are notified by email and in the portal, and your request shows as <strong>Pending</strong> until they decide. You&apos;ll get an email and a 🔔 notification when it&apos;s approved or denied.</>,
            ]} />
          </Section>

          <Section id="history" title="5. Checking Your Request History">
            <p>Go to <strong>My Request History</strong> to see every leave request you&apos;ve submitted, with summary counts for Total, Approved, Pending, and Hours Approved.</p>
            <Bullets items={[
              'Filter by status (All / Pending / Approved / Denied / Cancelled) or by leave type.',
              'Click any row with a note icon to expand it and see your note, or — if denied — the reason given.',
              <>Made a mistake? Click <strong>Cancel</strong> on a request that is Pending, was recorded automatically (Sick), or is approved but hasn&apos;t started yet — no approval needed. Any hours already taken off your balance go back and the day is cleared from your timesheet. Leave an approver approved that has already started, or in a pay period accounting has closed, must be changed by your Accounting Manager. Balances are shown in half-hour steps.</>,
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
              <p><strong className="text-[#0b2b35]">Reviewing a timesheet:</strong> open the Timesheets tab, use <strong>Show daily entries</strong> to check the hours, then click <strong>✓ Approve</strong>, or <strong>Return for correction</strong> with a reason code and notes (both required) to unlock it for the employee. To fix an already-approved timesheet, use the <strong>Approved</strong> tab → <strong>Reopen for correction</strong>; once accounting has closed the period only the CEO sees the <strong>CEO override</strong> button. Employee correction requests are flagged there, and every reopen is recorded in the timesheet&apos;s <strong>History</strong>.</p>
              <p>The employee is emailed and notified in the portal of every approval, denial, or return.</p>
              <p><strong className="text-[#0b2b35]">Close Period:</strong> when time for a range of dates is final, open <strong>Close Period</strong> in the sidebar, pick the from/through dates on the calendar (or a pay period as a shortcut), review the list of anything unfinished, and confirm. Closed dates accept no new leave requests and their timesheets can&apos;t be changed by employees; only the CEO can reopen them (override) or lift the closure.</p>
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
