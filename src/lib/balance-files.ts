// Keeps an original copy of every balance file that is parsed for a load, in a private bucket. Not a 'use server' file:
// callers are the (already authorised) server actions.

import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'balance-files'

/** Saves the uploaded file and returns its storage path. (A file uploaded but never committed is still kept — it's evidence too.) */
export async function storeBalanceFile(admin: SupabaseClient, file: File, folder: 'import' | 'override' | 'compare'): Promise<string> {
  const safe = file.name.replace(/[^\w.\- ()]+/g, '_')
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}-${safe}`
  const { error } = await admin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(`Couldn’t save a copy of the file: ${error.message}`)
  return path
}

/** A short-lived link to download a stored balance file. */
export async function signedBalanceFileUrl(admin: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 300)
  if (error || !data) throw new Error(error?.message ?? 'File not found')
  return data.signedUrl
}
