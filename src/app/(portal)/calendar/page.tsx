import { redirect } from 'next/navigation'
import { todayET } from '@/lib/pay-periods'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getLeaveEventsInRange, getUpcomingLeave } from '@/app/actions/calendar'
import { calendarGridRange } from '@/lib/calendar-grid'
import CalendarClient from '@/components/CalendarClient'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const [y, m] = todayET().split('-').map(Number) // the current month in Eastern Time, not the server's UTC
  const year = y
  const month = m - 1
  const range = calendarGridRange(year, month)

  const [events, upcoming] = await Promise.all([
    getLeaveEventsInRange(range.start, range.end),
    getUpcomingLeave(),
  ])

  return <CalendarClient initialYear={year} initialMonth={month} initialEvents={events} upcoming={upcoming} />
}
