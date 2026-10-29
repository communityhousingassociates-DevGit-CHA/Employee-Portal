// Records server errors for the super-admin System dashboard (Errors tab). Errors thrown as UserError are the refusals people see
// on screen ("This pay period is closed…") — they're logged as 'user_blocked' so a failed submit that left no other trace can still
// be found. Redirects and not-found are normal control flow and are skipped.

const USER_PREFIX = 'USER_ERROR:'

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined
  if (digest && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(digest)) return
  const message = err instanceof Error ? err.message : String(err)
  const userBlocked = !!digest?.startsWith(USER_PREFIX) || (err instanceof Error && err.name === 'UserError')

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { recordAppError } = await import('@/lib/system-log')
  await recordAppError(createAdminClient(), {
    kind: userBlocked ? 'user_blocked' : 'server_error',
    message: userBlocked && digest?.startsWith(USER_PREFIX) ? digest.slice(USER_PREFIX.length) : message,
    digest, path: request.path, route: context.routePath, routeType: context.routeType, method: request.method,
  })
}
