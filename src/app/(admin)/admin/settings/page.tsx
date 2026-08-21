import { redirect } from 'next/navigation'
import { getCurrentEmployee } from '@/lib/auth/session'
import { getMileageRates } from '@/app/actions/mileage-rates'
import PortalSettingsClient from '@/components/PortalSettingsClient'

export const dynamic = 'force-dynamic'

const ALLOWED = ['admin', 'ceo', 'accounting_manager']

export default async function AdminSettingsPage() {
  const employee = await getCurrentEmployee()
  if (!employee || !ALLOWED.includes(employee.role)) redirect('/dashboard')

  const mileageRates = await getMileageRates()
  const canEditMileage = employee.role === 'admin' || employee.role === 'accounting_manager'

  return <PortalSettingsClient mileageRates={mileageRates} canEditMileage={canEditMileage} />
}
