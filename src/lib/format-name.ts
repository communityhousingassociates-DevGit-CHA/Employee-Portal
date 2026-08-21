/** Mirrors the Postgres generated `name` column on `employees` — keep these in sync. */
export function buildFullName(first: string, last: string, middleInitial?: string | null): string {
  const mi = (middleInitial ?? '').trim().replace(/\.+$/, '')
  const parts = [first.trim(), mi ? `${mi}.` : null, last.trim()].filter(Boolean)
  return parts.join(' ')
}
