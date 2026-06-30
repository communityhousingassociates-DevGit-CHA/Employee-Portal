import Image from 'next/image'
import Link from 'next/link'

const DEMO_EMAIL = 'demo@communityhousingassociates.org'
const DEMO_PASSWORD = 'CHAdemo2026!'

export default function ScopePage() {
  return (
    <div className="min-h-screen bg-[#f0f7f8] py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-[#d4eef2] p-10 mb-6 shadow-sm">
          <div className="flex items-start justify-between mb-8">
            <Image src="/cha-logo.png" alt="Community Housing Associates" width={220} height={36} className="object-contain" />
            <div className="text-right text-[12px] text-gray-400 leading-relaxed">
              <p className="font-semibold text-[#0b2b35]">Prepared by Globalist Pro</p>
              <p>globalistpro.com</p>
              <p>June 2026</p>
            </div>
          </div>

          <div className="border-t border-[#f0f7f8] pt-8">
            <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-2">Project Scope & Proposal</p>
            <h1 className="text-[32px] font-bold text-[#0b2b35] leading-tight mb-3">CHA Employee Portal</h1>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-xl">
              A custom-built HR self-service portal for Community Housing Associates — enabling employees to manage leave requests,
              timesheets, and benefits without spreadsheets or third-party software fees.
            </p>
          </div>
        </div>

        {/* Demo Access */}
        <div className="bg-[#0b2b35] rounded-2xl p-8 mb-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-3">Demo Access</p>
          <h2 className="text-[20px] font-bold text-white mb-2">Try the portal now</h2>
          <p className="text-[13px] text-gray-400 mb-6">
            Log in below using the demo account to explore all Phase 1 features. The demo is pre-populated with
            realistic data for <strong className="text-white">Alex Torres</strong>, CEO — with full access to the
            approval queue, employee roster, and payroll reports.
          </p>
          <div className="bg-white/10 rounded-xl p-5 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Name</p>
              <p className="text-white font-semibold text-[14px]">Alex Torres</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Email</p>
              <p className="text-white font-semibold text-[14px] break-all">{DEMO_EMAIL}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Password</p>
              <p className="text-white font-semibold text-[14px] font-mono">{DEMO_PASSWORD}</p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-block bg-[#02ACC0] text-white text-[14px] font-semibold px-6 py-2.5 rounded-lg hover:bg-[#028a9e] transition-colors">
            Go to Login →
          </Link>
        </div>

        {/* Problem & Solution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-[#d4eef2] p-7 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-3">The Problem</p>
            <p className="text-[14px] text-gray-600 leading-relaxed">
              CHA managed employee leave and timesheets through shared spreadsheets — creating version conflicts,
              approval delays, and no audit trail. Manual entry increased the risk of payroll errors and
              compliance gaps.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#d4eef2] p-7 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-3">The Solution</p>
            <p className="text-[14px] text-gray-600 leading-relaxed">
              A custom web portal — owned entirely by CHA — with no per-seat licensing fees,
              digital signatures on every request, a full audit log, and a single approval queue
              accessible from any device.
            </p>
          </div>
        </div>

        {/* Phase 1 Features */}
        <div className="bg-white rounded-2xl border border-[#d4eef2] p-8 mb-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-3">Phase 1 Features</p>
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-6">What&apos;s included</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: '🔐',
                title: 'Secure Login',
                desc: 'Email + password auth with role-based access (Employee, CEO, Admin). Demo mode for client previews.',
              },
              {
                icon: '📊',
                title: 'Dashboard',
                desc: 'Dynamic greeting, live pay period progress bar, PTO/Sick/Personal balance cards, recent requests, and CEO pending-approval banner.',
              },
              {
                icon: '📝',
                title: 'Leave Requests',
                desc: 'Visual leave-type selector cards showing live balance, auto-fills hours from date range, team conflict checker, inline digital signature, and balance preview panel.',
              },
              {
                icon: '✅',
                title: 'Approval Queue',
                desc: 'CEO queue with urgency badges, balance-before/after progress bars, employee notes, two-step approve or deny with required reason and CEO countersignature.',
              },
              {
                icon: '📋',
                title: 'Request History',
                desc: 'Stat cards, status and leave-type filters, expandable rows revealing employee notes and denial reasons with approver attribution.',
              },
              {
                icon: '🕐',
                title: 'Timesheets',
                desc: 'Bi-weekly editable time grid with pay period navigation, leave-row highlighting, incomplete-row warnings, hours progress bar, and digital signature.',
              },
              {
                icon: '📅',
                title: 'Team Calendar',
                desc: 'Color-coded monthly grid showing team leave, holidays, and your own scheduled time off. Upcoming leave sidebar with approval status.',
              },
              {
                icon: '📈',
                title: 'Payroll Reports',
                desc: 'Per-employee stacked leave bars, accrual rates, PTO cap warning at 75%, personal balance column, and one-click PDF export with CHA header.',
              },
              {
                icon: '👥',
                title: 'Employee Roster',
                desc: 'Live search, employment-type filter, computed tenure, expandable rows showing individual PTO/Sick/Personal balances drawn from payroll data.',
              },
              {
                icon: '⚙️',
                title: 'Admin Panel',
                desc: 'User creation, role assignment (Employee / CEO / Admin), and system configuration — accessible only to Admin accounts.',
              },
            ].map(f => (
              <div key={f.title} className="flex gap-3 items-start p-4 bg-[#f8fcfd] rounded-xl border border-[#e8f4f7]">
                <span className="text-[22px] leading-none mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-[13px] font-semibold text-[#0b2b35]">{f.title}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Portal Pages Detail */}
        <div className="bg-white rounded-2xl border border-[#d4eef2] p-8 mb-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-3">Portal Pages</p>
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-6">Every screen, fully built</h2>

          <div className="space-y-5">
            {[
              {
                page: '/dashboard',
                label: 'Dashboard',
                color: 'bg-[#02ACC0]',
                bullets: [
                  'Dynamic greeting with first name and live date',
                  'Pay period progress bar (days elapsed vs. days remaining)',
                  'Three balance cards — PTO, Sick, Personal — each with accrual rate badge and days equivalent',
                  'Recent leave requests with color-coded status borders',
                  'Timesheet status card with due-today indicator',
                  'Upcoming leave preview and quick-links panel',
                  'Amber banner for CEO when pending approvals are waiting',
                ],
              },
              {
                page: '/request',
                label: 'Leave Request',
                color: 'bg-violet-500',
                bullets: [
                  '5 leave type cards (PTO, Sick, Personal, Bereavement, Jury Duty) each showing current balance',
                  'Start / end date pickers with auto-fill button calculating workdays × 8 hrs',
                  'Live balance preview — current → remaining with progress bar; red if negative',
                  'Team coverage panel — flags teammates already approved during the same dates',
                  'Optional note field for approver context',
                  'Click-to-sign digital signature with employee name and timestamp',
                  'Submit button enabled only when all required fields are complete and signed',
                  'Confirmation screen with link to history and option to submit another',
                ],
              },
              {
                page: '/history',
                label: 'Request History',
                color: 'bg-amber-400',
                bullets: [
                  'Stat strip: total requests, approved count, pending count, total approved hours',
                  'Status filter tabs (All / Pending / Approved / Denied) with live counts',
                  'Leave-type dropdown filter',
                  'Expandable rows showing employee note and denial reason with approver name',
                  'Color bar per leave type for instant visual scanning',
                  'Relative timestamps ("3d ago", "2mo ago") on each request',
                ],
              },
              {
                page: '/approvals',
                label: 'Approval Queue',
                color: 'bg-emerald-500',
                bullets: [
                  'Stats strip — pending count, total hours in queue, oldest request age',
                  'Pending and Reviewed tabs',
                  'Rich approval card: urgency badge, hours grid, balance-after progress bar, employee note',
                  'Two-step approve: inline confirmation with CEO name + date before committing',
                  'Two-step deny: requires typed reason before confirming denial',
                  'Reviewed cards archived with outcome, reason, and approver signature',
                ],
              },
              {
                page: '/timesheet',
                label: 'Timesheet',
                color: 'bg-[#0b2b35]',
                bullets: [
                  'Pay period navigator (‹ ›) with bi-weekly labels',
                  'Week 1 / Week 2 sections each with daily hour inputs and subtotals',
                  'Leave rows highlighted purple with Leave badge; incomplete rows flagged amber',
                  'Four stat cards: Regular Hours, Leave Hours, Total, Remaining to 80',
                  'Progress bar — teal under 80 hrs, green at 80, red if over',
                  'Digital signature section with submitted confirmation state',
                ],
              },
              {
                page: '/calendar',
                label: 'Team Calendar',
                color: 'bg-rose-400',
                bullets: [
                  'Full monthly grid with navigation — defaults to next month',
                  'Color-coded event chips: PTO (teal), Sick (violet), Personal (amber), Bereavement (slate), Holiday (rose), My Leave (navy)',
                  'Today highlighted with teal ring; own leave days shown in dark navy',
                  'Upcoming Leave sidebar for next 30 days with approval status badges',
                  'My Scheduled Leave dark card linking to full request history',
                ],
              },
              {
                page: '/reports',
                label: 'Payroll Reports',
                color: 'bg-teal-500',
                bullets: [
                  'Pay period selector (6 rolling bi-weekly periods)',
                  'Leave type filter tabs: All / PTO / Sick / Personal',
                  'Four stat cards: PTO Used, Sick Used, Personal Used, Employees with Leave',
                  'Per-employee stacked horizontal bars (teal=PTO, violet=Sick, amber=Personal)',
                  'Table with accrual rate, PTO cap % with amber warning ≥ 75%, personal balance',
                  "PDF export: print-optimized layout with CHA logo header and today's date",
                ],
              },
              {
                page: '/employees',
                label: 'Employee Roster',
                color: 'bg-indigo-500',
                bullets: [
                  'Stat cards: Active, Full-time, Part-time, Consultants',
                  'Live search by name, title, or department',
                  'Employment type tabs (All / Full-time / Part-time / Consultant)',
                  'Include Inactive toggle',
                  'Computed tenure (X yr Y mo) from hire date vs. today',
                  'Hash-based avatar colors for consistent visual identity',
                  'Expandable detail rows showing PTO, Sick, Personal balance cards from payroll data',
                ],
              },
            ].map(p => (
              <div key={p.page} className="border border-[#e8f4f7] rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-[#f8fcfd] border-b border-[#e8f4f7]">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                  <p className="text-[13px] font-bold text-[#0b2b35]">{p.label}</p>
                  <code className="text-[11px] text-gray-400 ml-1">{p.page}</code>
                </div>
                <ul className="px-5 py-4 space-y-1.5">
                  {p.bullets.map(b => (
                    <li key={b} className="flex gap-2 text-[12px] text-gray-500">
                      <span className="text-[#02ACC0] flex-shrink-0 mt-0.5">›</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Policy Highlights */}
        <div className="bg-white rounded-2xl border border-[#d4eef2] p-8 mb-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-3">Leave Policy</p>
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-5">CHA accrual rules built-in</h2>
          <div className="space-y-3 text-[13px] text-gray-600">
            <div className="flex gap-3 items-start">
              <span className="text-[#02ACC0] font-bold mt-0.5">•</span>
              <span><strong className="text-[#0b2b35]">PTO:</strong> Tenure-based accrual — 4.62 to 6.00 hrs/pay period (0–12 mo → 36+ mo); 400-hour carryover cap</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-[#02ACC0] font-bold mt-0.5">•</span>
              <span><strong className="text-[#0b2b35]">Sick Leave:</strong> Fixed 3.69 hrs/pay period, no cap</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-[#02ACC0] font-bold mt-0.5">•</span>
              <span><strong className="text-[#0b2b35]">Personal Days:</strong> 3 days/year; forfeited if unused at year-end</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-[#02ACC0] font-bold mt-0.5">•</span>
              <span><strong className="text-[#0b2b35]">New Hire Waiting Period:</strong> 90-day hold before PTO and personal days can be used</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-[#02ACC0] font-bold mt-0.5">•</span>
              <span><strong className="text-[#0b2b35]">Negative Balance:</strong> Allowed with CEO (Nico Sanders) approval</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-[#02ACC0] font-bold mt-0.5">•</span>
              <span><strong className="text-[#0b2b35]">Single Approver:</strong> All requests route to Nico Sanders, President &amp; CEO</span>
            </div>
          </div>
        </div>

        {/* Technology Stack */}
        <div className="bg-white rounded-2xl border border-[#d4eef2] p-8 mb-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-3">Technology</p>
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-5">Built to last, built to own</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Framework', value: 'Next.js 16 (React)' },
              { label: 'Authentication', value: 'Supabase Auth' },
              { label: 'Database', value: 'Supabase (PostgreSQL)' },
              { label: 'Hosting', value: 'Vercel' },
              { label: 'Domain', value: 'portal.communityhousingassociates.org' },
              { label: 'Ownership', value: '100% CHA — no vendor lock-in' },
            ].map(t => (
              <div key={t.label} className="bg-[#f8fcfd] rounded-xl p-4 border border-[#e8f4f7]">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{t.label}</p>
                <p className="text-[13px] font-semibold text-[#0b2b35]">{t.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-[#d4eef2] p-8 mb-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[#02ACC0] mb-3">Deployment Schedule</p>
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-6">6-Week Rollout Plan</h2>

          <div className="space-y-0">
            {[
              {
                week: 'Week 1',
                title: 'Discovery & Environment Setup',
                items: [
                  'Stakeholder kickoff — requirements sign-off',
                  'Branding and design direction confirmed',
                  'Supabase project creation and database schema',
                  'Development environment and repo initialized',
                ],
              },
              {
                week: 'Week 2',
                title: 'Authentication & Core Framework',
                items: [
                  'Employee login / logout (Supabase Auth)',
                  'Role-based access: Employee, CEO, Admin',
                  'Navigation layout and sidebar',
                  'Leave balance dashboard (live data)',
                ],
              },
              {
                week: 'Week 3',
                title: 'Leave Management',
                items: [
                  'Leave request form with digital signature',
                  'Request history view with status filters',
                  'CEO approval queue (approve / deny)',
                  'Email notification on status change',
                ],
              },
              {
                week: 'Week 4',
                title: 'Timesheets & Scheduling',
                items: [
                  'Bi-weekly editable timesheet grid',
                  'Timesheet digital signature',
                  'Team leave calendar (monthly view)',
                  'Public holiday overlays',
                ],
              },
              {
                week: 'Week 5',
                title: 'Admin Panel, Reports & QA',
                items: [
                  'Employee roster with accrual tier management',
                  'Admin user creation and role assignment',
                  'Bi-weekly payroll report (PDF export)',
                  'Full QA pass across all pages and roles',
                ],
              },
              {
                week: 'Week 6',
                title: 'Deployment, Training & Go-Live',
                items: [
                  'Vercel production deploy',
                  'Domain DNS configuration (portal.communityhousingassociates.org)',
                  'Real employee data entry and account creation',
                  'Training session with Nico Sanders & Carrileen Edwards',
                ],
              },
              {
                week: 'Week 7',
                title: 'Post-Launch Support (Buffer)',
                items: [
                  'Bug fixes and edge-case handling',
                  'Feedback-driven adjustments',
                  'Final sign-off and handoff documentation',
                ],
                buffer: true,
              },
            ].map((phase, i) => (
              <div key={phase.week} className={`flex gap-5 ${i < 6 ? 'pb-6' : ''}`}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${phase.buffer ? 'bg-gray-100 text-gray-400 border border-gray-200' : 'bg-[#02ACC0] text-white'}`}>
                    {i + 1}
                  </div>
                  {i < 6 && <div className={`w-px flex-1 mt-2 ${phase.buffer ? 'bg-gray-200' : 'bg-[#d4eef2]'}`} />}
                </div>
                <div className="pb-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${phase.buffer ? 'text-gray-400' : 'text-[#02ACC0]'}`}>{phase.week}</span>
                    {phase.buffer && <span className="text-[10px] bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 font-medium">Optional Buffer</span>}
                  </div>
                  <p className={`text-[14px] font-semibold mb-2 ${phase.buffer ? 'text-gray-400' : 'text-[#0b2b35]'}`}>{phase.title}</p>
                  <ul className="space-y-1">
                    {phase.items.map(item => (
                      <li key={item} className={`text-[13px] flex gap-2 ${phase.buffer ? 'text-gray-400' : 'text-gray-500'}`}>
                        <span className={`mt-1 flex-shrink-0 ${phase.buffer ? 'text-gray-300' : 'text-[#02ACC0]'}`}>›</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[12px] text-gray-400 pb-4 space-y-1">
          <p>Questions? Contact <span className="text-[#02ACC0]">hello@globalistpro.com</span></p>
          <p>portal.communityhousingassociates.org · Powered by Globalist Pro</p>
          <div className="pt-2">
            <Link href="/login" className="text-[#02ACC0] hover:text-[#028a9e] font-medium underline underline-offset-2 transition-colors">
              ← Back to Login
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
