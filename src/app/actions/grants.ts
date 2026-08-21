'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/session'

export async function getGrants() {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { data, error } = await admin.from('grants').select('id, name, is_active, created_at').order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addGrant(name: string) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('grants').insert({ name, is_active: true })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/grants')
}

export async function renameGrant(id: string, name: string) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('grants').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/grants')
}

export async function deactivateGrant(id: string) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('grants').update({ is_active: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/grants')
}

export async function restoreGrant(id: string) {
  await requireRole(['admin'])
  const admin = createAdminClient()
  const { error } = await admin.from('grants').update({ is_active: true }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/grants')
}
