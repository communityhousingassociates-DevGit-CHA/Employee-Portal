import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getMyBalance, getMyRecentRequests, getNextApprovedLeave, getPendingLeaveApprovals } from '@/app/actions/leave-requests'
import { getOrCreateTimesheet } from '@/app/actions/timesheets'
import { getCurrentPeriod } from '@/lib/pay-periods'
import { calcTier, PTO_CARRYOVER_CAP } from '@/lib/constants/accrual'

const PERSONAL_CAP = 24

const TYPE_COLOR: Record<string, { bar: string; badge: string }> = {
  PTO: { bar: 'bg-[#02ACC0]', badge: 'bg-[#e0f5f8] text-[#028a9e]' },
  Sick: { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700' },
  Personal: { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  Bereavement: { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  'Jury Duty': { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-700',
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysAgo(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff}d ago`
}

const MANAGER_ROLES = ['accounting_manager', 'ceo', 'admin']

export default async function DashboardPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const isManager = MANAGER_ROLES.includes(employee.role)
  const firstName = employee.name.split(' ')[0] || 'there'

  const period = getCurrentPeriod()
  const [balance, recent, nextLeave, { timesheet, rows }, pendingApprovals] = await Promise.all([
    getMyBalance(),
    getMyRecentRequests(4),
    getNextApprovedLeave(),
    getOrCreateTimesheet(period.start, period.end),
    isManager ? getPendingLeaveApprovals() : Promise.resolve([]),
  ])

  const pendingCount = pendingApprovals.length
  const oldestPending = pendingApprovals.reduce<string | null>((min, a) => (!min || a.created_at < min ? a.created_at : min), null)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dayLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const periodStart = new Date(`${period.start}T00:00:00`)
  const periodEnd = new Date(`${period.end}T00:00:00`)
  const periodDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1
  const daysPast = Math.min(Math.max(Math.round((now.getTime() - periodStart.getTime()) / 86400000) + 1, 1), periodDays)
  const periodPct = Math.round((daysPast / periodDays) * 100)

  const ptoHours = balance ? Number(balance.pto_hours) : 0
  const sickHours = balance ? Number(balance.sick_hours) : 0
  const personalHours = balance ? Number(balance.personal_hours) : 0
  const ptoDays = Math.floor(ptoHours / 8)
  const sickDays = Math.floor(sickHours / 8)
  const personalDays = Math.floor(personalHours / 8)
  const ptoRate = calcTier(employee.hire_date).ptoRate

  const tsTotalReg = rows.reduce((s, r) => s + Number(r.regular_hours), 0)
  const tsTotalLeave = rows.reduce((s, r) => s + Number(r.leave_hours), 0)
  const tsTotal = tsTotalReg + tsTotalLeave
  const tsTarget = 80
  const tsPct = Math.min(Math.round((tsTotal / tsTarget) * 100), 100)
  const tsRemaining = Math.max(tsTarget - tsTotal, 0)
  const dueSoon = timesheet.status === 'draft'

  return (
    <div className="space-y-6">
      {isManager && pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-[13px] flex-shrink-0">{pendingCount}</div>
            <div>
              <p className="text-[13px] font-semibold text-amber-800">{pendingCount} leave request{pendingCount > 1 ? 's' : ''} awaiting your approval</p>
              {oldestPending && <p className="text-[11px] text-amber-600 mt-0.5">Oldest request submitted {daysAgo(oldestPending)} · review before pay period ends</p>}
            </div>
          </div>
          <Link href="/approvals" className="bg-amber-500 text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg hover:bg-amber-600 transition-colors flex-shrink-0">Review Now →</Link>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-[#0b2b35]">{greeting}, {firstName}</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{dayLabel}</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-36 h-1.5 bg-[#e8f4f7] rounded-full overflow-hidden">
              <div className="h-full bg-[#02ACC0] rounded-full transition-all" style={{ width: `${periodPct}%` }} />
            </div>
            <p className="text-[11px] text-gray-400">Pay period {fmtDate(period.start)} – {fmtDate(period.end)} · day {daysPast} of {periodDays}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/calendar" className="text-[13px] font-semibold px-4 py-2 rounded-lg border border-[#d4eef2] text-[#0b2b35] hover:bg-[#f0f7f8] transition-colors">Calendar</Link>
          <Link href="/request" className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">+ Request Leave</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-[#d4eef2] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#02ACC0] rounded-t-xl" />
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">PTO Balance</p>
          <div className="flex items-end gap-2 mb-0.5">
            <p className="text-[38px] font-black text-[#0b2b35] leading-none">{ptoHours}</p>
            <p className="text-[13px] text-gray-400 mb-1.5">hrs</p>
          </div>
          <p className="text-[12px] text-gray-400 mb-3">≈ {ptoDays} working days</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className="h-full bg-[#02ACC0] rounded-full" style={{ width: `${Math.min((ptoHours / PTO_CARRYOVER_CAP) * 100, 100)}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-gray-400">{ptoHours} / {PTO_CARRYOVER_CAP} hr cap</p>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+{ptoRate}/pp</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#d4eef2] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-violet-500 rounded-t-xl" />
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Sick Leave</p>
          <div className="flex items-end gap-2 mb-0.5">
            <p className="text-[38px] font-black text-[#0b2b35] leading-none">{sickHours}</p>
            <p className="text-[13px] text-gray-400 mb-1.5">hrs</p>
          </div>
          <p className="text-[12px] text-gray-400 mb-3">≈ {sickDays} working days</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: '100%' }} />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-gray-400">No annual cap</p>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+3.69/pp</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#d4eef2] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400 rounded-t-xl" />
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Personal Days</p>
          <div className="flex items-end gap-2 mb-0.5">
            <p className="text-[38px] font-black text-[#0b2b35] leading-none">{personalDays}</p>
            <p className="text-[13px] text-gray-400 mb-1.5">days</p>
          </div>
          <p className="text-[12px] text-gray-400 mb-3">{personalHours} hrs</p>
          <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-1">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min((personalHours / PERSONAL_CAP) * 100, 100)}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-gray-400">{personalHours} / {PERSONAL_CAP} hrs</p>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Resets Jan 1</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4eef2]">
            <h2 className="text-[14px] font-bold text-[#0b2b35]">Recent Leave Requests</h2>
            <Link href="/history" className="text-[12px] font-semibold text-[#02ACC0] hover:underline">View All →</Link>
          </div>
          <div className="divide-y divide-[#f0f7f8]">
            {recent.length === 0 && <p className="px-5 py-6 text-[13px] text-gray-400">No requests yet.</p>}
            {recent.map(r => {
              const tc = TYPE_COLOR[r.leave_type] || TYPE_COLOR.PTO
              const dateRange = r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}`
              return (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`w-1 h-10 rounded-full flex-shrink-0 ${tc.bar}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>{r.leave_type}</span>
                      <span className="text-[12px] text-gray-400">{dateRange}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{r.hours} hrs · submitted {daysAgo(r.created_at)}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize flex-shrink-0 ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                </div>
              )
            })}
          </div>
          <div className="px-5 py-3 border-t border-[#f0f7f8] bg-[#fafefe]">
            <Link href="/request" className="text-[12px] font-semibold text-[#02ACC0] hover:underline">+ Submit a new request</Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#d4eef2]">
              <h2 className="text-[13px] font-bold text-[#0b2b35] flex items-center gap-1.5">
                Timesheet
                {dueSoon && <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />}
              </h2>
              <Link href="/timesheet" className="text-[11px] font-semibold text-[#02ACC0] hover:underline">Open →</Link>
            </div>
            <div className="px-4 py-4">
              <p className="text-[11px] text-gray-400 mb-0.5">{fmtDate(period.start)} – {fmtDate(period.end)}</p>
              <div className="flex items-end gap-1.5 mb-2">
                <span className="text-[22px] font-black text-[#0b2b35]">{tsTotal}</span>
                <span className="text-[12px] text-gray-400 mb-1">/ {tsTarget} hrs</span>
              </div>
              <div className="bg-[#f0f7f8] rounded-full h-1.5 overflow-hidden mb-2">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${tsPct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[timesheet.status] ?? 'bg-gray-100 text-gray-500'}`}>{timesheet.status}</span>
                <span className="text-[11px] text-gray-400">{tsRemaining} hrs remaining</span>
              </div>
            </div>
          </div>

          {nextLeave ? (
            <div className="bg-[#0b2b35] rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#02ACC0] mb-2">Upcoming Leave</p>
              <p className="text-white font-semibold text-[14px]">{nextLeave.leave_type}</p>
              <p className="text-gray-400 text-[12px] mt-0.5">
                {fmtDate(nextLeave.start_date)}{nextLeave.start_date !== nextLeave.end_date ? ` – ${fmtDate(nextLeave.end_date)}` : ''} · {nextLeave.hours} hrs
              </p>
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <span className="text-[11px] text-emerald-400 font-medium">Approved</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#d4eef2] p-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Upcoming Leave</p>
              <p className="text-[13px] text-gray-400">No approved leave scheduled.</p>
              <Link href="/request" className="text-[12px] font-semibold text-[#02ACC0] mt-2 inline-block hover:underline">Plan time off →</Link>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#d4eef2] divide-y divide-[#f0f7f8] overflow-hidden">
            {[
              { href: '/history', label: 'My Request History', icon: '🕐' },
              { href: '/calendar', label: 'Team Leave Calendar', icon: '📅' },
              { href: '/expenses', label: 'My Expenses', icon: '🧾' },
              ...(isManager ? [{ href: '/approvals', label: `Pending Approvals (${pendingCount})`, icon: '✅' }] : []),
            ].map(item => (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8fcfd] transition-colors">
                <span className="text-[14px]">{item.icon}</span>
                <span className="text-[12px] font-medium text-[#0b2b35]">{item.label}</span>
                <span className="ml-auto text-gray-300 text-[11px]">›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
