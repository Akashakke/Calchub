export interface YearRow {
  year: number
  principal: number
  interest: number
  balance: number
}

export interface EmiResult {
  emi: number
  months: number
  totalPayment: number
  totalInterest: number
  schedule: YearRow[]
}

/**
 * Monthly instalment for a reducing-balance loan.
 * EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), r = annual rate ÷ 12 ÷ 100.
 * With a 0% rate it's simply P ÷ n.
 */
export function emi(
  principal: number | null,
  annualRatePct: number | null,
  months: number | null,
): EmiResult | null {
  if (principal === null || annualRatePct === null || months === null) return null
  if (principal <= 0 || annualRatePct < 0 || months < 1) return null
  const n = Math.round(months)
  const r = annualRatePct / 12 / 100
  const pay = r === 0 ? principal / n : (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1)

  const schedule: YearRow[] = []
  let balance = principal
  for (let m = 1; m <= n; m++) {
    const interest = balance * r
    const toPrincipal = Math.min(pay - interest, balance)
    balance = Math.max(balance - toPrincipal, 0)
    const yearIdx = Math.ceil(m / 12) - 1
    const row = (schedule[yearIdx] ??= { year: yearIdx + 1, principal: 0, interest: 0, balance: 0 })
    row.principal += toPrincipal
    row.interest += interest
    row.balance = balance
  }

  const totalPayment = pay * n
  return { emi: pay, months: n, totalPayment, totalInterest: totalPayment - principal, schedule }
}
