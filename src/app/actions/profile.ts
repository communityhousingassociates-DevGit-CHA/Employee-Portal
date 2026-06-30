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
  name: string
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
