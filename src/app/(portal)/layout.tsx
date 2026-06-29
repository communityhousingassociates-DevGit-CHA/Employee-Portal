import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let displayName = 'User'
  let initials = 'U'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: emp } = await supabase
        .from('employees')
        .select('name')
        .eq('user_id', user.id)
        .single()
      displayName = emp?.name || user.email?.split('@')[0] || 'User'
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
            <span className="font-bold text-[15px]">Employee Portal</span>
            <span className="text-[11px] text-white/50 ml-2">communityhousingassociates.org</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-[#02ACC0] flex items-center justify-center text-[11px] font-bold">
            {initials}
          </div>
          <span className="text-[13px]">{displayName}</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
