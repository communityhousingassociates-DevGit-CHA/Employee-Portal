'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import { hasPayrollAccess } from '@/lib/constants/salary-access'
import { TAG_COLORS } from '@/lib/timesheet-tags'
import type { Employee, TimesheetTag } from '@/types'

/** Managing the tag list is limited to the payroll-access group (Nico, Carrileen, super admin). */
async function requireTagManager(): Promise<Employee> {
  const employee = await getCurrentEmployee()
  if (!employee || !hasPayrollAccess(employee)) throw new Error('Forbidden')
  return employee
}

/** The full tag list for pickers and display — any signed-in employee. The payroll `code` is only sent to managers. */
export async function getTagList(): Promise<TimesheetTag[]> {
  const me = await getCurrentEmployee()
  if (!me) return []
  const admin = createAdminClient()
  const { data, error } = await admin.from('timesheet_tags').select('id, name, color, description, code, is_active').order('name')
  if (error) throw new Error(error.message)
  const manager = hasPayrollAccess(me)
  return (data ?? []).map(t => ({ ...t, code: manager ? t.code : null })) as TimesheetTag[]
}

/** Tag list plus how many timesheet days use each tag — for the management page. */
export async function getManagedTags(): Promise<(TimesheetTag & { usage: number })[]> {
  await requireTagManager()
  const admin = createAdminClient()
  const { data, error } = await admin.from('timesheet_tags').select('id, name, color, description, code, is_active').order('name')
  if (error) throw new Error(error.message)
  const tags = (data ?? []) as TimesheetTag[]
  const usage = await Promise.all(tags.map(async t => {
    const { count } = await admin.from('timesheet_rows').select('id', { count: 'exact', head: true }).contains('tag_ids', [t.id])
    return count ?? 0
  }))
  return tags.map((t, i) => ({ ...t, usage: usage[i] }))
}

function clean(input: { name: string; color: string; description?: string; code?: string }) {
  const name = input.name.trim()
  if (!name) throw new Error('Give the tag a name')
  if (name.length > 40) throw new Error('Tag names can be at most 40 characters')
  if (!TAG_COLORS[input.color]) throw new Error('Choose a color')
  return { name, color: input.color, description: input.description?.trim() || null, code: input.code?.trim() || null }
}

function friendly(message: string) {
  return message.includes('timesheet_tags_name_uniq') ? 'A tag with that name already exists' : message
}

export async function createTag(input: { name: string; color: string; description?: string; code?: string }) {
  const actor = await requireTagManager()
  const row = clean(input)
  const admin = createAdminClient()
  const { error } = await admin.from('timesheet_tags').insert({ ...row, created_by: actor.id })
  if (error) throw new Error(friendly(error.message))
  revalidatePath('/admin/tags')
}

export async function updateTag(id: string, input: { name: string; color: string; description?: string; code?: string }) {
  await requireTagManager()
  const row = clean(input)
  const admin = createAdminClient()
  const { error } = await admin.from('timesheet_tags').update(row).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  revalidatePath('/admin/tags')
  revalidatePath('/timesheet')
}

/** Retire or restore a tag. Retired tags stay on the days that already use them but can't be picked again. */
export async function setTagActive(id: string, active: boolean) {
  await requireTagManager()
  const admin = createAdminClient()
  const { error } = await admin.from('timesheet_tags').update({ is_active: active }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/tags')
  revalidatePath('/timesheet')
}
