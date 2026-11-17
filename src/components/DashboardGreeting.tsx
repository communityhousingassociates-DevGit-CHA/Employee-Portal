'use client'

// Client component (the greeting follows the clock). Always Eastern Time — CHA's timezone — whatever the viewer's device
// or the Vercel function's clock (UTC) says. suppressHydrationWarning is the documented React pattern for text that
// legitimately differs between server render and client (the time keeps moving), so it is expected, not a bug.
export default function DashboardGreeting({ firstName }: { firstName: string }) {
  const now = new Date()
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric' }).format(now))
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dayLabel = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div suppressHydrationWarning>
      <p className="dx-eyebrow">{dayLabel}</p>
      <h1 className="dx-h1">{greeting}, {firstName}</h1>
    </div>
  )
}
