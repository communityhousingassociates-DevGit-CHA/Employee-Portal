/** Denials must tell the employee why. Not a 'use server' file — shared by the server actions and the approval forms. */
export const DENY_REASON_MIN_CHARS = 10

/** Returns a message when the reason is too thin to be useful (a stray word or a few letters), else null. */
export function denyReasonProblem(reason: string): string | null {
  const text = reason.trim()
  if (text.length < DENY_REASON_MIN_CHARS || text.split(/\s+/).length < 2) {
    return `Enter a real reason for the denial (at least ${DENY_REASON_MIN_CHARS} characters, in a short sentence) — the employee will see it.`
  }
  return null
}
