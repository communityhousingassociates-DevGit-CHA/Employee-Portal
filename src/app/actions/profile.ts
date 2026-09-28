'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export async function updateProfile(data: {
  first_name: string
  last_name: string
  middle_initial: string | null
  job_title: string | null
  department: string | null
}) {
  const userId = await getAuthUserId()
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update(data).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function updateAvatarUrl(avatarUrl: string | null) {
  const userId = await getAuthUserId()
  const admin = createAdminClient()
  const { error } = await admin.from('employees').update({ avatar_url: avatarUrl }).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function getSignedUploadUrl(fileName: string) {
  const userId = await getAuthUserId()
  const admin = createAdminClient()
  const ext = fileName.split('.').pop()
  const path = `${userId}.${ext}`
  const { data, error } = await admin.storage.from('avatars').createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  return { signedUrl: data.signedUrl, path, token: data.token }
}

export async function getPublicAvatarUrl(path: string) {
  const admin = createAdminClient()
  const { data } = admin.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Sets the employee's paid year-end holiday: Christmas Eve or New Year's Eve (SOP §4). It can be changed until December 1
 * so a timesheet already covering the day is never rewritten under someone. New choices apply to timesheets created from then on.
 */
export async function setYearEndHoliday(choice: 'christmas_eve' | 'new_years_eve') {
  if (choice !== 'christmas_eve' && choice !== 'new_years_eve') throw new Error('Choose Christmas Eve or New Year’s Eve.')
  const userId = await getAuthUserId()
  const admin = createAdminClient()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  const { data: emp, error: readError } = await admin.from('employees').select('year_end_holiday').eq('user_id', userId).single()
  if (readError) throw new Error(readError.message)
  if (emp.year_end_holiday && emp.year_end_holiday !== choice && today.slice(5, 7) === '12') {
    throw new Error('Your year-end holiday is locked as of December 1. Contact your Accounting Manager to change it.')
  }
  const { error } = await admin.from('employees').update({ year_end_holiday: choice }).eq('user_id', userId)
  if (error) throw new Error(error.message)
}
