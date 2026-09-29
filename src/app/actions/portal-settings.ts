'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, requireSuperAdmin } from '@/lib/auth/session'
import { resolveGeofenceSettings, parseRegions, type GeofenceSettings } from '@/lib/geofence'
import { POLICY_KEYS, resolvePolicy, type PolicySettings } from '@/lib/policy'
import { loadPolicy } from '@/lib/policy-server'

const EDIT_ROLES = ['admin', 'ceo', 'accounting_manager'] as const

// Sensible bounds so a typo (a stray extra zero, a negative) can't wreck accruals or lock everyone out of leave.
const LIMITS: Record<keyof PolicySettings, { min: number; max: number; label: string }> = {
  pto_tier_0_12: { min: 0, max: 400, label: 'PTO 0–12 months' },
  pto_tier_13_24: { min: 0, max: 400, label: 'PTO 13–24 months' },
  pto_tier_25_36: { min: 0, max: 400, label: 'PTO 25–36 months' },
  pto_tier_36_plus: { min: 0, max: 400, label: 'PTO 36+ months' },
  sick_rate_per_pp: { min: 0, max: 24, label: 'Sick accrual' },
  personal_hours_per_year: { min: 0, max: 200, label: 'Personal Days' },
  carryover_cap_under_60_months: { min: 0, max: 2000, label: 'Carryover cap (under 60 months)' },
  carryover_cap_60_months_plus: { min: 0, max: 2000, label: 'Carryover cap (60+ months)' },
  new_hire_waiting_days: { min: 0, max: 365, label: 'New-hire waiting period' },
  personal_waiting_months: { min: 0, max: 24, label: 'Personal Days waiting period' },
  approval_reminder_days: { min: 1, max: 30, label: 'Approval reminder' },
}

export async function getPolicySettings(): Promise<PolicySettings> {
  await requireRole([...EDIT_ROLES])
  return loadPolicy(createAdminClient())
}

/** Saves the leave-policy numbers. Everything saved here is read by the accrual engine, year-end jobs, leave checks and the approver digest. */
export async function savePolicySettings(input: PolicySettings): Promise<PolicySettings> {
  const me = await requireRole([...EDIT_ROLES])
  const values: Record<string, number> = {}
  for (const key of POLICY_KEYS) {
    const v = Number(input[key])
    const { min, max, label } = LIMITS[key]
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${label} must be a number between ${min} and ${max}.`)
    values[key] = Math.round(v * 100) / 100
  }
  const admin = createAdminClient()
  // Merge into the stored values so other keys (the sign-in location rule) are never wiped by saving the policy numbers.
  const { data: current } = await admin.from('portal_settings').select('values').maybeSingle()
  const { error } = await admin.from('portal_settings').upsert({ id: true, values: { ...((current?.values as Record<string, unknown>) ?? {}), ...values }, updated_by: me.id, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
  revalidatePath('/request')
  revalidatePath('/dashboard')
  return resolvePolicy(values)
}

/** Portal-wide sign-in location rule (enforced by the middleware — see lib/geofence.ts). */
export async function getGeofenceSettings(): Promise<GeofenceSettings> {
  await requireRole([...EDIT_ROLES])
  const { data } = await createAdminClient().from('portal_settings').select('values').maybeSingle()
  return resolveGeofenceSettings(data?.values as Record<string, unknown> | undefined)
}

/** Super admin only: switch the location rule on/off and set the allowed states. */
export async function saveGeofenceSettings(input: { enabled: boolean; regionsText: string }): Promise<GeofenceSettings> {
  const me = await requireSuperAdmin()
  const regions = parseRegions(input.regionsText)
  if (input.enabled && (!regions || regions.some(r => !/^[A-Z]{2}$/.test(r)))) throw new Error('Enter two-letter US state codes separated by commas, e.g. MD, DC, VA, PA, DE.')
  const admin = createAdminClient()
  const { data: current } = await admin.from('portal_settings').select('values').maybeSingle()
  const values = { ...((current?.values as Record<string, unknown>) ?? {}), geofence_enabled: !!input.enabled, ...(regions ? { geofence_regions: regions } : {}) }
  const { error } = await admin.from('portal_settings').upsert({ id: true, values, updated_by: me.id, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
  return resolveGeofenceSettings(values)
}
