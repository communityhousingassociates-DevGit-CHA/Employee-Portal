import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getTestAccountIds } from '@/lib/test-accounts'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const employee = await getCurrentEmployee()
  const admin = createAdminClient()
  const testIds = employee?.is_test_account ? new Set<string>() : await getTestAccountIds(admin)
  const testIdList = testIds.size ? `(${[...testIds].join(',')})` : null
  let pendingLeaveQuery = admin.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  let pendingExpensesQuery = admin.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (testIdList) {
    pendingLeaveQuery = pendingLeaveQuery.not('employee_id', 'in', testIdList)
    pendingExpensesQuery = pendingExpensesQuery.not('employee_id', 'in', testIdList)
  }
  const [{ count: active }, { count: archived }, { count: pendingLeave }, { count: pendingExpenses }, { count: pendingImports }] = await Promise.all([
    admin.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_test_account', false),
    admin.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', false).eq('is_test_account', false),
    pendingLeaveQuery,
    pendingExpensesQuery,
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
          { label: 'Active Employees', value: active ?? 0, icon: '👥', color: 'text-[#02ACC0]', bar: 'bg-[#02ACC0]' },
          { label: 'Pending Approvals', value: pendingApprovals, icon: '⏳', color: 'text-amber-500', bar: 'bg-amber-400' },
          { label: 'Inactive Users', value: archived ?? 0, icon: '🗄️', color: 'text-gray-400', bar: 'bg-gray-300' },
        ].map(s => (
          <div key={s.label} className="relative bg-white rounded-xl border border-[#d4eef2] p-5 overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 ${s.bar}`} />
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`text-[28px] font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-[13px] font-bold text-[#0b2b35] mb-3 uppercase tracking-wide">User Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { href: '/admin/users', icon: '👤', title: 'Manage Employees', desc: 'View, edit, and manage every portal user', color: 'bg-[#02ACC0]' },
              { href: '/admin/users?action=new', icon: '➕', title: 'Add Employee', desc: 'Create a new employee record', color: 'bg-emerald-600' },
              { href: '/admin/import', icon: '📥', title: 'Bulk Import', desc: 'Load employees from a spreadsheet', color: 'bg-rose-500' },
            ].map(t => (
              <Link key={t.href} href={t.href} className={`${t.color} rounded-xl p-5 text-white hover:opacity-90 transition-opacity group`}>
                <span className="text-[24px]">{t.icon}</span>
                <h3 className="text-[14px] font-bold uppercase tracking-wide mt-3">{t.title}</h3>
                <p className="text-[12px] text-white/80 mt-1 leading-snug">{t.desc}</p>
                <span className="text-[11px] font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all">VIEW <span>→</span></span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-[13px] font-bold text-[#0b2b35] mb-3 uppercase tracking-wide">Portal Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { href: '/admin/grants', icon: '🏷️', title: 'Grants & Funding', desc: 'Manage grants and funding sources', color: 'bg-violet-500' },
              { href: '/admin/settings#leave', icon: '📋', title: 'Leave Policy', desc: 'Accrual rules and leave settings', color: 'bg-amber-500' },
              { href: '/admin/settings#payroll', icon: '💰', title: 'Payroll Settings', desc: 'Pay periods and payroll configuration', color: 'bg-slate-600' },
            ].map(t => (
              <Link key={t.href} href={t.href} className={`${t.color} rounded-xl p-5 text-white hover:opacity-90 transition-opacity group`}>
                <span className="text-[24px]">{t.icon}</span>
                <h3 className="text-[14px] font-bold uppercase tracking-wide mt-3">{t.title}</h3>
                <p className="text-[12px] text-white/80 mt-1 leading-snug">{t.desc}</p>
                <span className="text-[11px] font-bold mt-3 inline-flex items-center gap-1 group-hover:gap-2 transition-all">VIEW <span>→</span></span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
