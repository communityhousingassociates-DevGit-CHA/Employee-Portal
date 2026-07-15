import Link from 'next/link'
import Image from 'next/image'
import ResponsiveShell from '@/components/ResponsiveShell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
      const admin = createAdminClient()
      const { data: emp } = await admin
        .from('employees')
        .select('name')
        .eq('user_id', user.id)
        .single()
      displayName = emp?.name || user.email?.split('@')[0] || 'Admin'
      initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }
  } catch {}

  return (
    <ResponsiveShell
      topbarLeft={
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-white rounded-lg px-2.5 py-1.5 flex items-center flex-shrink-0">
            <Image src="/cha-logo.png" alt="Community Housing Associates" width={160} height={26} className="object-contain" />
          </div>
          <span className="text-white/50 text-[12px] font-medium tracking-wide hidden sm:block">Admin Console</span>
        </div>
      }
      topbarRight={
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard"
            className="text-[12px] text-white/60 hover:text-white transition-colors items-center gap-1.5 hidden sm:flex flex-shrink-0">
            ← Back to Portal
          </Link>
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 min-w-0">
            <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
              {initials}
            </div>
            <span className="text-[13px] truncate hidden sm:inline">{displayName}</span>
            <span className="text-[10px] bg-red-500/80 px-1.5 py-0.5 rounded-full font-semibold ml-1 flex-shrink-0">ADMIN</span>
          </div>
        </div>
      }
      sidebar={
        <nav className="w-[220px] bg-[#0b2b35] flex flex-col flex-shrink-0 overflow-y-auto h-full">
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
      }
    >
      <div className="bg-[#f0f7f8] -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 min-h-full">
        {children}
      </div>
    </ResponsiveShell>
  )
}
