import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const employee = await getCurrentEmployee()
  const admin = createAdminClient()
  const [{ count: active }, { count: archived }, { count: pendingLeave }, { count: pendingExpenses }, { count: pendingImports }] = await Promise.all([
    admin.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', false),
    admin.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    employee?.is_super_admin
      ? admin.from('import_batches').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
  ])

  const pendingApprovals = (pendingLeave ?? 0) + (pendingExpenses ?? 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0b2b35]">Admin Console</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Manage users, leave policy, and portal settings for Community Housing Associates</p>
      </div>

      {employee?.is_super_admin && (pendingImports ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📥</span>
            <div>
              <p className="text-[13px] font-bold text-amber-800">
                {pendingImports} import batch{pendingImports === 1 ? '' : 'es'} awaiting your review
              </p>
              <p className="text-[12px] text-amber-700">An admin has prepared a data import — only you can commit it.</p>
            </div>
          </div>
          <Link href="/admin/import" className="bg-amber-600 text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors">
            Review Now →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Employees', value: active ?? 0, icon: '👥', color: 'text-[#02ACC0]' },
          { label: 'Pending Approvals', value: pendingApprovals, icon: '⏳', color: 'text-amber-500' },
          { label: 'Archived Users', value: archived ?? 0, icon: '🗄️', color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-[#d4eef2] p-5">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`text-[28px] font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#d4eef2] p-6">
          <h2 className="text-[14px] font-bold text-[#0b2b35] mb-4">User Management</h2>
          <div className="flex flex-col gap-2">
            <Link href="/admin/users" className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">👤</span> View &amp; manage all employees
            </Link>
            <Link href="/admin/users?action=new" className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">➕</span> Add new employee
            </Link>
            <Link href="/admin/import" className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">📥</span> Bulk import from spreadsheet
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#d4eef2] p-6">
          <h2 className="text-[14px] font-bold text-[#0b2b35] mb-4">Portal Settings</h2>
          <div className="flex flex-col gap-2">
            <Link href="/admin/grants" className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">🏷️</span> Manage grants &amp; funding sources
            </Link>
            <Link href="/admin/settings#leave" className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">📋</span> Leave policy &amp; accrual rules
            </Link>
            <Link href="/admin/settings#payroll" className="flex items-center gap-3 p-3 rounded-lg border border-[#d4eef2] hover:border-[#02ACC0] hover:bg-[#f0f7f8] transition-colors text-[13px] font-medium text-[#0b2b35]">
              <span className="text-lg">💰</span> Pay period &amp; payroll settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
