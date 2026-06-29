'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/request', icon: '📋', label: 'Request Leave' },
  { href: '/history', icon: '🕐', label: 'My Requests' },
  { href: '/timesheet', icon: '⏱', label: 'Timesheets' },
  { href: '/calendar', icon: '📅', label: 'Leave Calendar' },
]

const adminItems = [
  { href: '/approvals', icon: '✅', label: 'Approvals', badge: 2 },
  { href: '/reports', icon: '📊', label: 'Reports' },
  { href: '/employees', icon: '👥', label: 'Employees' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="w-[220px] bg-white border-r border-[#d4eef2] flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="p-3 pt-5">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 px-2 mb-1.5">My Portal</p>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors
              ${pathname === item.href
                ? 'bg-[#e0f5f8] text-[#028a9e] font-bold'
                : 'text-gray-700 hover:bg-[#f0f7f8]'}`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="p-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 px-2 mb-1.5">Admin</p>
        {adminItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors
              ${pathname === item.href
                ? 'bg-[#e0f5f8] text-[#028a9e] font-bold'
                : 'text-gray-700 hover:bg-[#f0f7f8]'}`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
            {'badge' in item && item.badge ? (
              <span className="ml-auto bg-[#02ACC0] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="mt-auto border-t border-[#d4eef2] p-3">
        <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-400 hover:bg-[#f0f7f8] w-full">
          <span className="w-5 text-center">⚙️</span> Settings
        </button>
        <button onClick={signOut} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-400 hover:bg-[#f0f7f8] w-full">
          <span className="w-5 text-center">🚪</span> Sign Out
        </button>
      </div>
    </nav>
  )
}
