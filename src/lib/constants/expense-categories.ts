import type { ExpenseCategory } from '@/types'

// Human labels for the stored enum values — underscore categories (rental_car etc.) read wrong if shown raw.
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  mileage: 'Mileage', hotel: 'Hotel', airline: 'Airline', meals: 'Meals', entertainment: 'Entertainment',
  cash_advance: 'Cash Advance', tolls: 'Tolls', conference_fees: 'Conference Fees', rental_car: 'Rental Car',
  gratuities: 'Gratuities', parking: 'Parking', other: 'Other',
}
