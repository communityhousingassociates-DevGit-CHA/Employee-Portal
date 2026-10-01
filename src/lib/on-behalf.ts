// Server-side guard for acting on another employee's behalf. Deliberately NOT a 'use server' file — every export from one of
// those becomes a directly callable server action; this is a helper used inside already-authorized ones.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentEmployee } from '@/lib/auth/session'
import { ON_BEHALF_ROLES, onBehalfProblem, type OnBehalf } from '@/lib/constants/on-behalf'
import type { Employee } from '@/types'

/**
 * Who is doing the action and whose it is. With no `onBehalf` it is the signed-in employee acting for themselves. With
 * one, the signed-in user must hold an on-behalf role, the target must be a different active employee, and the reason
 * code and notes must be acceptable — otherwise it throws. Never returns a half-valid pairing.
 */
export async function resolveActor(
  admin: SupabaseClient,
  target: { employeeId?: string | null; onBehalf?: OnBehalf | null },
): Promise<{ actor: Employee; subject: Employee; onBehalf: OnBehalf | null }> {
  const actor = await getCurrentEmployee()
  if (!actor) throw new Error('Forbidden')
  if (!target.employeeId || target.employeeId === actor.id) return { actor, subject: actor, onBehalf: null }

  if (!ON_BEHALF_ROLES.includes(actor.role)) throw new Error('Forbidden')
  const problem = target.onBehalf ? onBehalfProblem(target.onBehalf) : 'Choose a reason for completing this on the employee’s behalf.'
  if (problem) throw new Error(problem)
  const { data: subject, error } = await admin.from('employees').select('*').eq('id', target.employeeId).single()
  if (error || !subject) throw new Error('Employee not found')
  if (!subject.is_active) throw new Error('This employee is inactive.')
  return { actor, subject: subject as Employee, onBehalf: { reasonCode: target.onBehalf!.reasonCode, note: target.onBehalf!.note.trim() } }
}

/** For read-only helpers that load an employee's own data (balances, booked days): self, or an on-behalf-capable role. */
export async function resolveSubjectId(employeeId?: string | null): Promise<string> {
  const actor = await getCurrentEmployee()
  if (!actor) throw new Error('Forbidden')
  if (!employeeId || employeeId === actor.id) return actor.id
  if (!ON_BEHALF_ROLES.includes(actor.role)) throw new Error('Forbidden')
  return employeeId
}
