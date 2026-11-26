export interface Expense {
  id: number
  name: string
  min: string
  max: string
}

export interface ExpenseCheck {
  min: number
  max: number
  error: string | null
}

/** Parses a cost field: blank → null, otherwise a finite number ≥ 0 or NaN. */
function parseCost(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

/**
 * Validates one expense row.
 * A blank max is treated as a fixed cost (max = min), and a blank min as 0.
 */
export function checkExpense(e: Expense): ExpenseCheck {
  const min = parseCost(e.min)
  const max = parseCost(e.max)
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return { min: 0, max: 0, error: 'Costs must be 0 or more' }
  }
  const lo = min ?? 0
  const hi = max ?? lo
  if (hi < lo) return { min: lo, max: hi, error: 'Max is lower than min' }
  return { min: lo, max: hi, error: null }
}

export interface Totals {
  min: number
  max: number
  counted: number
  errors: number
}

/** Sums every row that has a cost and no error. */
export function totalExpenses(list: Expense[]): Totals {
  const totals: Totals = { min: 0, max: 0, counted: 0, errors: 0 }
  for (const e of list) {
    if (e.min.trim() === '' && e.max.trim() === '') continue
    const c = checkExpense(e)
    if (c.error) {
      totals.errors++
      continue
    }
    totals.min += c.min
    totals.max += c.max
    totals.counted++
  }
  return totals
}
