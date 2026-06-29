import Link from 'next/link'
import { MOCK_EMPLOYEES } from '@/lib/mock-data'

const active = MOCK_EMPLOYEES.filter(e => e.status === 'active').length

export default function AdminPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0b2b35]">Admin Console</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Manage users, leave policy, and portal settings for Community Housing Associates</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Employees', value: active, icon: '👥', color: 'text-[#02ACC0]' },
          { label: 'Pending Approvals', value: 2, icon: '⏳', color: 'text-amber-500' },
          { label: 'Open Timesheets', value: 1, icon: '⏱', color: 'text-violet-500' },
          { label: 'Archived Users', value: 0, icon: '🗄️', color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`text-[28px] font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#d4eef2] p-6">
          <h2 className="text-[14px] font-bold text-[#0b2b35] mb-4">User Management</h2>
          <div className="flex flex-col gap-2">
            <Link href="/admin/users"
              className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">👤</span> View &amp; manage all employees
            </Link>
            <Link href="/admin/users?action=new"
              className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">➕</span> Add new employee
            </Link>
            <Link href="/admin/users?filter=archived"
              className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">🗄️</span> View archived employees
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#d4eef2] p-6">
          <h2 className="text-[14px] font-bold text-[#0b2b35] mb-4">Portal Settings</h2>
          <div className="flex flex-col gap-2">
            <Link href="/admin/settings#leave"
              className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">📋</span> Leave policy &amp; accrual rules
            </Link>
            <Link href="/admin/settings#payroll"
              className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">💰</span> Pay period &amp; payroll settings
            </Link>
            <Link href="/admin/settings#notifications"
              className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">🔔</span> Notification &amp; email settings
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}
