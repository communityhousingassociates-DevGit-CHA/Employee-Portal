'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/session'
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
  const { error } = await admin.from('portal_settings').upsert({ id: true, values, updated_by: me.id, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
  revalidatePath('/request')
  revalidatePath('/dashboard')
  return resolvePolicy(values)
}
