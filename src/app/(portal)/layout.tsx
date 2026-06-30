import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MOCK_USER } from '@/lib/mock-data'
import { cookies } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let displayName = 'User'
  let initials = 'U'
  let role: 'employee' | 'accounting_manager' | 'ceo' | 'admin' = 'employee'
  let avatarUrl: string | null = null

  const cookieStore = await cookies()
  const isDemo = cookieStore.get('cha-demo')?.value === 'true'

  if (isDemo) {
    displayName = MOCK_USER.name
    initials = MOCK_USER.avatar
    role = MOCK_USER.role
  } else {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = createAdminClient()
        const { data: emp } = await admin
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
  }

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="bg-[#0b2b35] text-white flex items-center px-6 h-14 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg px-2.5 py-1.5 flex items-center flex-shrink-0">
            <Image src="/cha-logo.png" alt="Community Housing Associates" width={160} height={26} className="object-contain" />
          </div>
          <span className="text-white/50 text-[12px] font-medium tracking-wide hidden sm:block">Employee Portal</span>
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
