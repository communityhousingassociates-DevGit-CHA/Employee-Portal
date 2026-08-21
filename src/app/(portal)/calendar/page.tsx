import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getLeaveEventsInRange, getUpcomingLeave } from '@/app/actions/calendar'
import { calendarGridRange } from '@/lib/calendar-grid'
import CalendarClient from '@/components/CalendarClient'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const employee = await getCurrentEmployee()
  if (!employee) redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const range = calendarGridRange(year, month)

  const [events, upcoming] = await Promise.all([
    getLeaveEventsInRange(range.start, range.end),
    getUpcomingLeave(),
  ])

  return <CalendarClient initialYear={year} initialMonth={month} initialEvents={events} upcoming={upcoming} />
}
