import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getMyExpenses } from '@/app/actions/expenses'
import { getOnBehalfTarget } from '@/app/actions/on-behalf'
import { canActOnBehalf } from '@/lib/constants/on-behalf'
import { getCurrentYearRate } from '@/app/actions/mileage-rates'
import ExpensesClient from '@/components/ExpensesClient'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const { for: forId } = await searchParams
  const me = await getCurrentEmployee()
  if (!me) redirect('/login')

  // A named administrator entering expenses for someone else (an exception — see OnBehalfPanel). Anyone else asking for it is sent home.
  let onBehalf: { employeeId: string; employeeName: string; actorName: string } | undefined
  if (forId && forId !== me.id) {
    if (!canActOnBehalf(me)) redirect('/dashboard')
    const target = await getOnBehalfTarget(forId).catch(() => null)
    if (!target || !target.is_active) redirect('/employees')
    onBehalf = { employeeId: target.id, employeeName: target.name, actorName: me.name }
  }

  const [expenses, currentRate] = await Promise.all([getMyExpenses(onBehalf?.employeeId), getCurrentYearRate()])
  return <ExpensesClient initialExpenses={expenses} currentMileageRate={currentRate} onBehalf={onBehalf} />
}
