import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let displayName = 'User'
  let initials = 'U'
  let role: 'employee' | 'accounting_manager' | 'ceo' | 'admin' = 'employee'
  let avatarUrl: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: emp } = await supabase
        .from('employees')
        .select('name, role, avatar_url')
        .eq('user_id', user.id)
        .single()
      displayName = emp?.name || user.email?.split('@')[0] || 'User'
      initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      if (emp?.role) role = emp.role
      if (emp?.avatar_url) avatarUrl = emp.avatar_url
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
            <span className="font-bold text-[15px]">Employee Portal</span>
            <span className="text-[11px] text-white/50 ml-2">communityhousingassociates.org</span>
          </div>
        </div>
        <Link href="/profile" className="ml-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 transition-colors">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={displayName} width={28} height={28} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#02ACC0] flex items-center justify-center text-[11px] font-bold">
              {initials}
            </div>
          )}
          <span className="text-[13px]">{displayName}</span>
        </Link>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar role={role} />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
