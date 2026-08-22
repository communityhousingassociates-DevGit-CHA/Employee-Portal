'use client'

// Client component so the greeting reflects the viewer's own local time and
// timezone, not the server's — a Server Component would compute this from
// the Vercel function's clock (UTC), which is frequently wrong for the
// person actually looking at the page. suppressHydrationWarning is the
// documented React pattern for exactly this case: server and client will
// legitimately render different text, and that's expected, not a bug.
export default function DashboardGreeting({ firstName }: { firstName: string }) {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dayLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div suppressHydrationWarning>
      <h1 className="text-[24px] font-bold text-[#0b2b35]">{greeting}, {firstName}</h1>
      <p className="text-[13px] text-gray-400 mt-0.5">{dayLabel}</p>
    </div>
  )
}
