// In production, Next.js replaces the message of any error thrown from a Server Action with a generic one (React error #441), so a
// validation message like "Insufficient balance" never reaches the screen. Errors that are MEANT for the user are thrown as
// UserError instead: it also carries the message in `digest`, the one field Next passes through to the browser untouched.
// errMsg() reads it back on the client. Internal failures (database errors etc.) stay plain Errors and remain redacted.

const PREFIX = 'USER_ERROR:'

export class UserError extends Error {
  digest: string
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
    this.digest = PREFIX + message
  }
}

/** The text to show for an error caught around a Server Action call. */
export function errMsg(e: unknown, fallback = 'Something went wrong'): string {
  const digest = (e as { digest?: unknown } | null)?.digest
  if (typeof digest === 'string' && digest.startsWith(PREFIX)) return digest.slice(PREFIX.length)
  if (e instanceof Error && e.message && !/Minified React error|omitted in production/i.test(e.message)) return e.message
  return fallback
}
