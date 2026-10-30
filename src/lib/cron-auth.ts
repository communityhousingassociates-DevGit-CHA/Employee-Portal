import { timingSafeEqual } from 'node:crypto'

/** True when `authorization` is exactly `Bearer <secret>`. Constant-time, and false whenever the secret is unset so a missing env var never opens the route. */
export function isCronAuthorized(authorization: string | null | undefined, secret: string | undefined): boolean {
  if (!secret) return false
  const got = Buffer.from(authorization ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}
