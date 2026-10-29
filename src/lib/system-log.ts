// Writers for the System dashboard's records (job_runs, app_errors). Both are best-effort: recording must never break the thing
// being recorded, so every failure here is swallowed. Not a 'use server' file.

import type { SupabaseClient } from '@supabase/supabase-js'

export async function recordJobRun(admin: SupabaseClient, job: string, startedAt: Date, ok: boolean, summary: string, detail?: unknown) {
  try {
    await admin.from('job_runs').insert({ job, started_at: startedAt.toISOString(), ok, summary: summary.slice(0, 500), detail: detail ?? null })
  } catch { /* best-effort */ }
}

export type AppErrorKind = 'server_error' | 'user_blocked'

export async function recordAppError(admin: SupabaseClient, e: { kind: AppErrorKind; message: string; digest?: string; path?: string; route?: string; routeType?: string; method?: string }) {
  try {
    await admin.from('app_errors').insert({
      kind: e.kind, message: e.message.slice(0, 500), digest: e.digest?.slice(0, 200) ?? null,
      path: e.path?.split('?')[0].slice(0, 200) ?? null, route: e.route?.slice(0, 200) ?? null, route_type: e.routeType ?? null, method: e.method ?? null,
    })
  } catch { /* best-effort */ }
}
