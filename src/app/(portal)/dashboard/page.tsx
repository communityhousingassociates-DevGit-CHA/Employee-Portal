import Link from 'next/link'
import { MOCK_BALANCES, MOCK_REQUESTS } from '@/lib/mock-data'
import { createClient } from '@/lib/supabase/server'

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-700',
  denied: 'bg-red-100 text-red-700',
}

export default async function DashboardPage() {
  const recent = MOCK_REQUESTS.slice(0, 3)

  let firstName = 'there'
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: emp } = await supabase.from('employees').select('name').eq('user_id', user.id).single()
      const name = emp?.name || user.email?.split('@')[0] || ''
      firstName = name.split(' ')[0] || 'there'
    }
  } catch {}

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">{greeting}, {firstName} ✦</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Monday, June 29, 2026 · Pay period ends July 4</p>
        </div>
        <Link href="/request"
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          + Request Leave
        </Link>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-white rounded-xl p-5 border border-[#d4eef2] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#02ACC0] rounded-t-xl" />
          <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">PTO Balance</p>
          <p className="text-[36px] font-black text-[#0b2b35] leading-none">{MOCK_BALANCES.pto.available}</p>
          <p className="text-[12px] text-gray-400 mt-0.5">hours available</p>
          <p className="text-[11px] text-emerald-600 mt-2">+{MOCK_BALANCES.pto.accrual} hrs this pay period</p>
          <div className="mt-3 bg-[#f0f7f8] rounded h-1 overflow-hidden">
            <div className="h-full bg-[#02ACC0] rounded" style={{ width: `${(MOCK_BALANCES.pto.available / MOCK_BALANCES.pto.cap) * 100}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{MOCK_BALANCES.pto.available} / {MOCK_BALANCES.pto.cap} hr cap</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#d4eef2] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-violet-600 rounded-t-xl" />
          <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">Sick Leave</p>
          <p className="text-[36px] font-black text-[#0b2b35] leading-none">{MOCK_BALANCES.sick.available}</p>
          <p className="text-[12px] text-gray-400 mt-0.5">hours available</p>
          <p className="text-[11px] text-emerald-600 mt-2">+{MOCK_BALANCES.sick.accrual} hrs this pay period</p>
          <div className="mt-3 bg-[#f0f7f8] rounded h-1 overflow-hidden">
            <div className="h-full bg-violet-500 rounded" style={{ width: '15%' }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">No annual cap</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#d4eef2] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 rounded-t-xl" />
          <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">Personal Days</p>
          <p className="text-[36px] font-black text-[#0b2b35] leading-none">{MOCK_BALANCES.personal.available}</p>
          <p className="text-[12px] text-gray-400 mt-0.5">hours available (2 of 3 days)</p>
          <p className="text-[11px] text-gray-400 mt-2">Resets January 1</p>
          <div className="mt-3 bg-[#f0f7f8] rounded h-1 overflow-hidden">
            <div className="h-full bg-amber-500 rounded" style={{ width: '33%' }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">2 of 3 days used</p>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-white rounded-xl border border-[#d4eef2] mb-5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4eef2]">
          <h2 className="text-[14px] font-bold text-[#0b2b35]">Recent Leave Requests</h2>
          <Link href="/history" className="text-[12px] font-semibold text-[#02ACC0] hover:underline">View All</Link>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f9fefe]">
              {['Type', 'Dates', 'Hours', 'Submitted', 'Status'].map(h => (
                <th key={h} className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 border-b border-[#d4eef2] font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.id} className="border-b border-[#f0f7f8] last:border-0">
                <td className="px-5 py-3">{r.type}</td>
                <td className="px-5 py-3">{r.start === r.end ? r.start : `${r.start} – ${r.end}`}</td>
                <td className="px-5 py-3">{r.hours}</td>
                <td className="px-5 py-3">{r.submitted}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusStyle[r.status]}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Timesheet */}
      <div className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d4eef2]">
          <h2 className="text-[14px] font-bold text-[#0b2b35]">
            Current Timesheet
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full ml-2 align-middle" />
          </h2>
          <Link href="/timesheet" className="text-[12px] font-semibold text-[#02ACC0] hover:underline">Open Timesheet</Link>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f9fefe]">
              {['Period', 'Due', 'Hours Logged', 'Status'].map(h => (
                <th key={h} className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wide text-gray-400 border-b border-[#d4eef2] font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-5 py-3">Jun 15 – Jun 28, 2026</td>
              <td className="px-5 py-3">Jun 30, 2026</td>
              <td className="px-5 py-3">72 / 80 hrs</td>
              <td className="px-5 py-3">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">In Progress</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
