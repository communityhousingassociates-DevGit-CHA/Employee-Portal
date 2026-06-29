import Sidebar from '@/components/Sidebar'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <header className="bg-[#0b2b35] text-white flex items-center px-6 h-14 flex-shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#02ACC0] rounded-lg flex items-center justify-center font-black text-sm">
            CHA
          </div>
          <div className="leading-tight">
            <span className="font-bold text-[15px]">Employee Portal</span>
            <span className="text-[11px] text-white/50 ml-2">communityhousingassociates.org</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-[#02ACC0] flex items-center justify-center text-[11px] font-bold">
            ME
          </div>
          <span className="text-[13px]">Maria Edwards</span>
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
