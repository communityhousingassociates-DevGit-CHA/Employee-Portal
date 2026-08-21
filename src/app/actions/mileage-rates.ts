'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/session'

const RATE_SETTER_ROLES = ['admin', 'accounting_manager'] as const

export async function getMileageRates() {
  await requireRole(['admin', 'accounting_manager', 'ceo'])
  const admin = createAdminClient()
  const { data, error } = await admin.from('mileage_rates').select('id, year, rate_per_mile, updated_at').order('year', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCurrentYearRate(): Promise<number | null> {
  const admin = createAdminClient()
  const year = new Date().getFullYear()
  const { data, error } = await admin.from('mileage_rates').select('rate_per_mile').eq('year', year).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.rate_per_mile ?? null
}

export async function setMileageRate(year: number, ratePerMile: number) {
  const actor = await requireRole([...RATE_SETTER_ROLES])
  const admin = createAdminClient()
  const { error } = await admin
    .from('mileage_rates')
    .upsert({ year, rate_per_mile: ratePerMile, updated_by: actor.id, updated_at: new Date().toISOString() }, { onConflict: 'year' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
}
