/** Parses a user-entered value; returns null unless it is a finite number > 0. */
export function positive(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Parses a user-entered value; returns null unless it is a finite number ≥ 0. */
export function nonNegative(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export interface CostResult {
  litres: number
  cost: number
}

/** Trip cost = (distance ÷ mileage) × price per litre. */
export function fuelCost(
  distanceKm: number | null,
  mileageKmpl: number | null,
  pricePerL: number | null,
): CostResult | null {
  if (distanceKm === null || mileageKmpl === null || pricePerL === null) return null
  const litres = distanceKm / mileageKmpl
  return { litres, cost: litres * pricePerL }
}

export interface EfficiencyResult {
  litres: number
  kmPerL: number
  lPer100km: number
}

/** Mileage = distance ÷ litres used. Litres can come directly or from amount spent ÷ price. */
export function fuelEfficiency(
  distanceKm: number | null,
  litres: number | null,
): EfficiencyResult | null {
  if (distanceKm === null || litres === null) return null
  return {
    litres,
    kmPerL: distanceKm / litres,
    lPer100km: (litres / distanceKm) * 100,
  }
}

export function litresFromSpend(
  amountSpent: number | null,
  pricePerL: number | null,
): number | null {
  if (amountSpent === null || pricePerL === null) return null
  return amountSpent / pricePerL
}

export interface RequiredResult {
  litres: number
  cost: number | null
}

/** Fuel needed = distance ÷ mileage; cost added when a price is given. */
export function fuelRequired(
  distanceKm: number | null,
  mileageKmpl: number | null,
  pricePerL: number | null,
): RequiredResult | null {
  if (distanceKm === null || mileageKmpl === null) return null
  const litres = distanceKm / mileageKmpl
  return { litres, cost: pricePerL === null ? null : litres * pricePerL }
}
