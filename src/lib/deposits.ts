/** Fixed Deposit (FD) and Recurring Deposit (RD) maths, as Indian banks calculate them. */

export interface DepositResult {
  maturity: number
  invested: number
  interest: number
  months: number
}

/** How many times a year interest is added to the balance. */
export type Compounding = 12 | 4 | 2 | 1

/**
 * FD: one lump sum, interest compounded `perYear` times a year.
 * A = P × (1 + r/n)^(n × t), r = yearly rate ÷ 100, t = years.
 */
export function fdMaturity(
  principal: number | null,
  annualRatePct: number | null,
  months: number | null,
  perYear: Compounding = 4,
): DepositResult | null {
  if (principal === null || annualRatePct === null || months === null) return null
  if (principal <= 0 || annualRatePct < 0 || months <= 0) return null
  const years = months / 12
  const maturity = principal * (1 + annualRatePct / 100 / perYear) ** (perYear * years)
  return { maturity, invested: principal, interest: maturity - principal, months }
}

/**
 * RD: the same amount deposited at the start of every month, interest compounded quarterly.
 * Each instalment grows for the months it stays in the account:
 * M = Σ R × (1 + r/400)^(m/3), for m = n, n−1, …, 1 months remaining.
 */
export function rdMaturity(
  monthly: number | null,
  annualRatePct: number | null,
  months: number | null,
): DepositResult | null {
  if (monthly === null || annualRatePct === null || months === null) return null
  const n = Math.round(months)
  if (monthly <= 0 || annualRatePct < 0 || n < 1) return null
  const q = 1 + annualRatePct / 400
  let maturity = 0
  for (let m = n; m >= 1; m--) maturity += monthly * q ** (m / 3)
  const invested = monthly * n
  return { maturity, invested, interest: maturity - invested, months: n }
}
