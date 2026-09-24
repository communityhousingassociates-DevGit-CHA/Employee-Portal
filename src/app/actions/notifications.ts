'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentEmployee } from '@/lib/auth/session'
import type { PortalNotification } from '@/types'

/** Latest notices for the signed-in employee plus the unread count that drives the topbar bell badge. */
export async function getMyNotifications(limit = 10): Promise<{ items: PortalNotification[]; unreadCount: number }> {
  const employee = await getCurrentEmployee()
  if (!employee) return { items: [], unreadCount: 0 }
  const admin = createAdminClient()
  const [{ data, error }, { count }] = await Promise.all([
    admin.from('notifications').select('*').eq('employee_id', employee.id).order('created_at', { ascending: false }).limit(limit),
    admin.from('notifications').select('id', { count: 'exact', head: true }).eq('employee_id', employee.id).is('read_at', null),
  ])
  if (error) throw new Error(error.message)
  return { items: (data ?? []) as PortalNotification[], unreadCount: count ?? 0 }
}

/** Marks the given notices read (or every unread one if no ids are passed). Scoped to the caller's own rows. */
export async function markNotificationsRead(ids?: string[]) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  let query = admin.from('notifications').update({ read_at: new Date().toISOString() }).eq('employee_id', employee.id).is('read_at', null)
  if (ids && ids.length > 0) query = query.in('id', ids)
  const { error } = await query
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}
