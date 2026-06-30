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
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-2">What&apos;s included</h2>
          <p className="text-[13px] text-gray-400 mb-6">14 features across 5 role-based access levels</p>

          {/* Role legend */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { role: 'Employee',           color: 'bg-[#e0f5f8] text-[#028a9e]' },
              { role: 'Supervisor',         color: 'bg-violet-50 text-violet-700' },
              { role: 'Accounting Manager', color: 'bg-amber-50 text-amber-700'  },
              { role: 'CEO',                color: 'bg-[#0b2b35] text-white'      },
              { role: 'Admin',              color: 'bg-gray-100 text-gray-600'    },
            ].map(r => (
              <span key={r.role} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${r.color}`}>{r.role}</span>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: '🔐',
                title: 'Secure Login & Role-Based Access',
                desc: 'Email + password auth with 5 access levels: Employee, Supervisor, Accounting Manager, CEO, and Admin. Each role sees only what is relevant to them.',
              },
              {
                icon: '📊',
                title: 'Dashboard',
                desc: 'Role-aware home screen. Employees see their own balances and upcoming leave. Supervisors and managers see pending action items. CEO sees org-wide summary.',
              },
              {
                icon: '📝',
                title: 'Leave Requests',
                desc: 'Visual leave-type cards showing live balance, date range with auto-fill hours, team conflict check, balance preview, and inline digital signature.',
              },
              {
                icon: '✅',
                title: 'Leave Approval Queue',
                desc: 'Routes to Nico Sanders (CEO). Two-step approve or deny with required reason and CEO countersignature. Urgency badges, balance-after preview, and archived reviewed tab.',
              },
              {
                icon: '📋',
                title: 'Leave Request History',
                desc: 'Full filterable log of submitted requests with status, approver, expandable denial reasons, and relative timestamps.',
              },
              {
                icon: '🕐',
                title: 'Timesheets — Employee Submission',
                desc: 'Bi-weekly editable grid with regular + leave hours per day. Progress bar, leave-row highlighting, digital employee signature, and save-draft capability.',
              },
              {
                icon: '✍️',
                title: 'Timesheet Supervisor Approval',
                desc: 'Department supervisors review and countersign their team\'s submitted timesheets before they are released to accounting. Each supervisor sees only their team.',
              },
              {
                icon: '📅',
                title: 'Team Calendar',
                desc: 'Color-coded monthly grid showing all team leave, public holidays, and personal scheduled time. Upcoming leave sidebar with approval status.',
              },
              {
                icon: '📈',
                title: 'Leave Balance Report',
                desc: 'Employees see only their own accrued balances. Supervisors see their team. Accounting managers and CEO see all staff. Exportable as PDF or CSV (Excel).',
              },
              {
                icon: '💼',
                title: 'Sage Payroll Report',
                desc: 'Bi-weekly report for the Accounting Manager showing regular hours worked + all leave types per employee per pay period — formatted for direct Sage data entry. PDF and CSV export.',
              },
              {
                icon: '📋',
                title: 'Onboarding Forms',
                desc: 'Digital new-hire packet (W-4, direct deposit, emergency contact, handbook acknowledgment, I-9 checklist) sent to new hires via email link. Completed forms stored and accessible by employee, Accounting Manager, and CEO.',
              },
              {
                icon: '👥',
                title: 'Employee Roster',
                desc: 'Live search, employment-type filter, computed tenure, and expandable detail rows with individual PTO/Sick/Personal balances.',
              },
              {
                icon: '📧',
                title: 'Email Notifications',
                desc: 'Automated emails on leave request submission, approval, and denial. Supervisor notified when a timesheet is ready for review. New hires receive onboarding form link.',
              },
              {
                icon: '⚙️',
                title: 'Admin Panel',
                desc: 'User creation, role assignment across all 5 access levels, department and supervisor mapping, and system configuration.',
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
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-2">Every screen, fully built</h2>
          <p className="text-[13px] text-gray-400 mb-6">
            Pages marked <span className="font-semibold text-amber-600">In Progress</span> are live in the demo.
            Pages marked <span className="font-semibold text-violet-600">Planned</span> are scoped for Phase 1 delivery.
          </p>

          <div className="space-y-5">
            {[
              {
                page: '/dashboard',
                label: 'Dashboard',
                color: 'bg-[#02ACC0]',
                status: 'live',
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
                status: 'live',
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
                status: 'live',
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
                status: 'live',
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
                status: 'live',
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
                status: 'live',
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
                status: 'live',
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
                status: 'live',
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
              {
                page: '/timesheet/approvals',
                label: 'Timesheet Supervisor Approval',
                color: 'bg-violet-500',
                status: 'planned',
                bullets: [
                  'Supervisors see only their own team\'s submitted timesheets',
                  'Review grid: regular hours + leave hours per day with totals',
                  'One-click approve or return with required comment',
                  'Supervisor digital countersignature with timestamp',
                  'Approved timesheets locked and forwarded to accounting queue',
                  'Dashboard notification badge for pending timesheets',
                ],
              },
              {
                page: '/accounting',
                label: 'Accounting Manager View & Sage Report',
                color: 'bg-amber-500',
                status: 'planned',
                bullets: [
                  'Dedicated login view for the Accounting Manager role',
                  'Bi-weekly payroll report: regular hours worked + PTO, Sick, Personal, Bereavement, and Jury Duty per employee',
                  'Formatted for direct Sage data entry — columns match Sage import fields',
                  'Only shows timesheets that have been supervisor-approved',
                  'PDF and CSV (Excel) export with pay period and generation date in filename',
                  'Access to leave balance report for all employees',
                  'Read-only access to completed onboarding forms',
                ],
              },
              {
                page: '/onboarding',
                label: 'Onboarding Forms',
                color: 'bg-emerald-500',
                status: 'planned',
                bullets: [
                  'Admin sends a unique onboarding link to a new hire\'s personal email',
                  'New hire completes digital forms: W-4, direct deposit, emergency contact, handbook acknowledgment, I-9 checklist',
                  'Each form auto-saves as the hire progresses; progress bar shows completion status',
                  'Digital signature required on each form before submission',
                  'Submitted forms stored securely and accessible by the employee, Accounting Manager, and CEO',
                  'Admin sees completion status for all pending new hires',
                  'Completed packet exportable as PDF',
                ],
              },
            ].map(p => (
              <div key={p.page} className="border border-[#e8f4f7] rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-[#f8fcfd] border-b border-[#e8f4f7]">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.color}`} />
                  <p className="text-[13px] font-bold text-[#0b2b35]">{p.label}</p>
                  <code className="text-[11px] text-gray-400 ml-1">{p.page}</code>
                  <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${'status' in p && p.status === 'planned' ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {'status' in p && p.status === 'planned' ? 'Planned' : 'Live in demo'}
                  </span>
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
          <h2 className="text-[20px] font-bold text-[#0b2b35] mb-2">8-Week Rollout Plan</h2>
          <p className="text-[13px] text-gray-400 mb-6">Expanded from the initial estimate to include onboarding forms, supervisor approval workflow, and the Sage accounting report.</p>

          <div className="space-y-0">
            {[
              {
                week: 'Week 1',
                title: 'Discovery & Environment Setup',
                items: [
                  'Stakeholder kickoff — requirements sign-off with Nico Sanders & Carrileen Edwards',
                  'Confirm department structure and supervisor assignments',
                  'Branding and design direction confirmed',
                  'Supabase project creation and full database schema (users, timesheets, leave, onboarding)',
                  'Development environment and repo initialized',
                ],
              },
              {
                week: 'Week 2',
                title: 'Authentication & Role-Based Access',
                items: [
                  'Employee login / logout (Supabase Auth)',
                  'All 5 roles configured: Employee, Supervisor, Accounting Manager, CEO, Admin',
                  'Department + supervisor mapping in admin panel',
                  'Navigation layout — each role sees a tailored sidebar',
                  'Role-aware dashboard (balances for employees, action items for managers)',
                ],
              },
              {
                week: 'Week 3',
                title: 'Leave Management',
                items: [
                  'Leave request form with digital employee signature',
                  'Request history view with status and type filters',
                  'CEO approval queue — two-step approve/deny with countersignature',
                  'Leave balance report: employee-only view and manager view (all staff)',
                  'Email notifications on submission, approval, and denial',
                ],
              },
              {
                week: 'Week 4',
                title: 'Timesheets — Employee & Supervisor Flow',
                items: [
                  'Bi-weekly editable timesheet grid with regular + leave hours',
                  'Employee digital signature and submission',
                  'Supervisor approval queue — scoped to their team only',
                  'Supervisor countersignature; approved timesheets locked for accounting',
                  'Team leave calendar (monthly view) with holiday overlays',
                ],
              },
              {
                week: 'Week 5',
                title: 'Onboarding Forms',
                items: [
                  'Admin sends unique onboarding link to new hire personal email',
                  'Digital form packet: W-4, direct deposit, emergency contact, handbook acknowledgment, I-9 checklist',
                  'Auto-save progress with completion status tracker',
                  'Digital signature on each form',
                  'Completed forms accessible by employee, Accounting Manager, and CEO',
                  'Admin dashboard showing pending and completed onboarding packets',
                ],
              },
              {
                week: 'Week 6',
                title: 'Accounting Manager View & Sage Report',
                items: [
                  'Dedicated Accounting Manager login and dashboard',
                  'Bi-weekly Sage payroll report: regular hrs + all leave types per employee',
                  'Columns formatted to match Sage data entry fields',
                  'PDF and CSV export with pay period in filename',
                  'Access to leave balance report (all employees) and completed onboarding forms',
                ],
              },
              {
                week: 'Week 7',
                title: 'Admin Panel, QA & Refinements',
                items: [
                  'Employee roster with tenure, balances, and accrual tiers',
                  'Admin user creation, role assignment, and department configuration',
                  'Full QA pass across all 5 roles and all pages',
                  'Feedback-driven refinements from CHA review session',
                  'Accessibility and mobile responsiveness review',
                ],
              },
              {
                week: 'Week 8',
                title: 'Deployment, Training & Go-Live',
                items: [
                  'Vercel production deploy',
                  'Domain DNS configuration (portal.communityhousingassociates.org)',
                  'Real employee data entry and account creation for all staff',
                  'Training session: employees, supervisors, accounting manager, and Nico Sanders',
                  'Handoff documentation',
                ],
              },
              {
                week: 'Week 9',
                title: 'Post-Launch Support (Buffer)',
                items: [
                  'Bug fixes and edge-case handling from live usage',
                  'Final sign-off',
                ],
                buffer: true,
              },
            ].map((phase, i) => (
              <div key={phase.week} className={`flex gap-5 ${i < 8 ? 'pb-6' : ''}`}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${phase.buffer ? 'bg-gray-100 text-gray-400 border border-gray-200' : 'bg-[#02ACC0] text-white'}`}>
                    {i + 1}
                  </div>
                  {i < 8 && <div className={`w-px flex-1 mt-2 ${phase.buffer ? 'bg-gray-200' : 'bg-[#d4eef2]'}`} />}
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
