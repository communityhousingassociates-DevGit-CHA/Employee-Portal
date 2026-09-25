/**
 * Leave balances are shown in half-hour steps. Stored balances keep cents (accruals like 4.62 / 3.69 per period), so this
 * is display-only, and it rounds DOWN — a person never sees more time available than they actually have.
 */
export function halfHour(n: number): number {
  return Math.floor(n * 2 + 1e-9) / 2
}

/** "24", "24.5", "-0.5" — no trailing decimals. */
export function fmtHrs(n: number): string {
  return String(halfHour(n))
}
