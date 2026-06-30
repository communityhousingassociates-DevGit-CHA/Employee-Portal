'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'employee' | 'accounting_manager' | 'ceo' | 'admin'

const portalItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/request', icon: '📋', label: 'Request Leave' },
  { href: '/history', icon: '🕐', label: 'My Requests' },
  { href: '/timesheet', icon: '⏱', label: 'Timesheets' },
  { href: '/calendar', icon: '📅', label: 'Leave Calendar' },
]

type AdminItem = { href: string; icon: string; label: string; badge?: number; roles: Role[] }

const adminItems: AdminItem[] = [
  { href: '/approvals', icon: '✅', label: 'Approvals', badge: 2, roles: ['accounting_manager', 'ceo', 'admin'] },
  { href: '/reports',   icon: '📊', label: 'Reports',             roles: ['accounting_manager', 'ceo', 'admin'] },
  { href: '/employees', icon: '👥', label: 'Employees',           roles: ['ceo', 'admin'] },
  { href: '/admin',     icon: '🛡️', label: 'Admin Console',       roles: ['admin'] },
]

export default function Sidebar({ role = 'employee' }: { role?: Role }) {
  const pathname = usePathname()
  const router = useRouter()

  const visibleAdminItems = adminItems.filter(item => item.roles.includes(role))

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const linkCls = (href: string) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${
      pathname === href ? 'bg-[#e0f5f8] text-[#028a9e] font-bold' : 'text-gray-700 hover:bg-[#f0f7f8]'
    }`

  return (
    <nav className="w-[220px] bg-white border-r border-[#d4eef2] flex flex-col flex-shrink-0 overflow-y-auto print:hidden">
      <div className="p-3 pt-5">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 px-2 mb-1.5">My Portal</p>
        {portalItems.map(item => (
          <Link key={item.href} href={item.href} className={linkCls(item.href)}>
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {visibleAdminItems.length > 0 && (
        <div className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 px-2 mb-1.5">Admin</p>
          {visibleAdminItems.map(item => (
            <Link key={item.href} href={item.href} className={linkCls(item.href)}>
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
              {item.badge ? (
                <span className="ml-auto bg-[#02ACC0] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-auto border-t border-[#d4eef2] p-3">
        <button onClick={signOut} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-400 hover:bg-[#f0f7f8] w-full">
          <span className="w-5 text-center">🚪</span> Sign Out
        </button>
      </div>
    </nav>
  )
}
