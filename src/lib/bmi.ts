export const CM_PER_INCH = 2.54
export const KG_PER_LB = 0.45359237

export interface BmiCategory {
  id: 'under' | 'normal' | 'over' | 'obese'
  label: string
  /** Lower bound (inclusive) of the BMI range. */
  from: number
}

/** WHO adult categories. */
export const CATEGORIES: BmiCategory[] = [
  { id: 'under', label: 'Underweight', from: 0 },
  { id: 'normal', label: 'Healthy weight', from: 18.5 },
  { id: 'over', label: 'Overweight', from: 25 },
  { id: 'obese', label: 'Obese', from: 30 },
]

export const HEALTHY_MIN = 18.5
export const HEALTHY_MAX = 24.9

export function categoryOf(bmi: number): BmiCategory {
  let found = CATEGORIES[0]
  for (const c of CATEGORIES) if (bmi >= c.from) found = c
  return found
}

export interface BmiResult {
  bmi: number
  category: BmiCategory
  /** Healthy weight range for this height, in kg. */
  healthyKg: [number, number]
}

/** BMI = weight (kg) ÷ height (m)². */
export function bmi(heightCm: number | null, weightKg: number | null): BmiResult | null {
  if (heightCm === null || weightKg === null || heightCm <= 0 || weightKg <= 0) return null
  const m = heightCm / 100
  const value = weightKg / (m * m)
  return {
    bmi: value,
    category: categoryOf(value),
    healthyKg: [HEALTHY_MIN * m * m, HEALTHY_MAX * m * m],
  }
}
