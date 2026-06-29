import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

const navItems = [
  { href: '/admin', icon: '🛡️', label: 'Admin Overview', exact: true },
  { href: '/admin/users', icon: '👥', label: 'User Management' },
  { href: '/admin/settings', icon: '⚙️', label: 'Portal Settings' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let displayName = 'Admin'
  let initials = 'A'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: emp } = await supabase
        .from('employees')
        .select('name')
        .eq('user_id', user.id)
        .single()
      displayName = emp?.name || user.email?.split('@')[0] || 'Admin'
      initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }
  } catch {}

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="bg-[#0b2b35] text-white flex items-center px-6 h-14 flex-shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 p-0.5">
            <Image src="/cha-logo.jpg" alt="CHA" width={36} height={36} className="object-contain w-full h-full" />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-[15px]">Admin Console</span>
            <span className="text-[11px] text-white/50 ml-2">CHA Employee Portal</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/dashboard"
            className="text-[12px] text-white/60 hover:text-white transition-colors flex items-center gap-1.5">
            ← Back to Portal
          </Link>
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
            <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-[11px] font-bold">
              {initials}
            </div>
            <span className="text-[13px]">{displayName}</span>
            <span className="text-[10px] bg-red-500/80 px-1.5 py-0.5 rounded-full font-semibold ml-1">ADMIN</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Admin Sidebar */}
        <nav className="w-[220px] bg-[#0b2b35] flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="p-3 pt-5">
            <p className="text-[10px] uppercase tracking-widest text-white/30 px-2 mb-2">Admin</p>
            {navItems.map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="mt-auto p-3 border-t border-white/10">
            <div className="px-3 py-2 text-[11px] text-white/30 leading-relaxed">
              Admin actions are logged and auditable. Changes take effect immediately.
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto bg-[#f0f7f8] p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
