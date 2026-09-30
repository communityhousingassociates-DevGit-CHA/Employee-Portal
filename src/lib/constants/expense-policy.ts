import type { ExpenseCategory } from '@/types'

// Expense documentation rules (CHA policy, set 2026-09-30). Change these to change policy.

/** A receipt is required for any non-mileage expense over this amount (USD). */
export const RECEIPT_REQUIRED_OVER = 75

/** Mileage has no receipt (the miles and a description are the record); every other category needs one above the threshold. */
export function receiptRequired(category: ExpenseCategory, amount: number): boolean {
  return category !== 'mileage' && Number.isFinite(amount) && amount > RECEIPT_REQUIRED_OVER
}

/** Mileage claims must say where and why (the description is the trip record); other categories keep it optional. */
export function descriptionRequired(category: ExpenseCategory): boolean {
  return category === 'mileage'
}
