import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getAllCurrentSalaries } from '@/app/actions/salary'
import SalaryClient from '@/components/SalaryClient'

export const dynamic = 'force-dynamic'

const ALLOWED = ['admin', 'ceo', 'accounting_manager']

export default async function AdminSalaryPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !ALLOWED.includes(employee.role)) redirect('/dashboard')

  const salaries = await getAllCurrentSalaries()
  return <SalaryClient initialSalaries={salaries} />
}
