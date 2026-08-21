import { getMyExpenses } from '@/app/actions/expenses'
import { getCurrentYearRate } from '@/app/actions/mileage-rates'
import ExpensesClient from '@/components/ExpensesClient'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const [expenses, currentRate] = await Promise.all([getMyExpenses(), getCurrentYearRate()])
  return <ExpensesClient initialExpenses={expenses} currentMileageRate={currentRate} />
}
