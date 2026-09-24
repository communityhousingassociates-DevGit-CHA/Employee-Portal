import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getAllCurrentSalaries } from '@/app/actions/salary'
import SalaryClient from '@/components/SalaryClient'
import { canViewSalaries } from '@/lib/constants/salary-access'

export const dynamic = 'force-dynamic'

export default async function AdminSalaryPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !canViewSalaries(employee)) redirect('/admin')

  const salaries = await getAllCurrentSalaries()
  return <SalaryClient initialSalaries={salaries} />
}
