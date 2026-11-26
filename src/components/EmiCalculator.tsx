import { useState } from 'react'
import { emi } from '../lib/emi'
import { nonNegative, positive } from '../lib/fuel'
import { fmt } from '../lib/format'
import { Field, Result, Segmented, missingOf } from './ui'

type TenureUnit = 'years' | 'months'
type AmountMode = 'direct' | 'cost'
type DownUnit = 'amount' | 'percent'

const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

/** Down payment rating: under 30% bad, 30–50% good, 50% or more very good. */
const DOWN_LEVELS = [
  { id: 'bad', label: 'Bad', from: 0, note: 'Under 30% down means a bigger loan and more interest.' },
  { id: 'good', label: 'Good', from: 30, note: 'A healthy down payment. Your loan and interest stay reasonable.' },
  { id: 'great', label: 'Very good', from: 50, note: 'Excellent! Half or more paid upfront keeps your loan and interest low.' },
] as const

function downLevel(percent: number) {
  return [...DOWN_LEVELS].reverse().find((l) => percent >= l.from)!
}

export default function EmiCalculator({ cur }: { cur: string }) {
  const [mode, setMode] = useState<AmountMode>('direct')
  const [amount, setAmount] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [downUnit, setDownUnit] = useState<DownUnit>('amount')
  const [downPercent, setDownPercent] = useState('')
  const [rate, setRate] = useState('')
  const [tenure, setTenure] = useState('')
  const [tenureUnit, setTenureUnit] = useState<TenureUnit>('years')
  const [showSchedule, setShowSchedule] = useState(false)

  // Loan amount comes either straight from the user or from total cost − down payment.
  const cost = positive(totalCost)
  // Down payment typed as an amount, or as a % of the total cost (50% of 1,00,000 = 50,000).
  const pct = nonNegative(downPercent)
  const down =
    downUnit === 'amount' ? nonNegative(downPayment) : pct !== null && cost !== null ? (cost * pct) / 100 : null
  const downTooBig = cost !== null && down !== null && down >= cost
  const derived = cost !== null && down !== null && !downTooBig ? cost - down : null
  const p = mode === 'direct' ? positive(amount) : derived
  const rt = nonNegative(rate)
  const t = positive(tenure)
  const months = t === null ? null : tenureUnit === 'years' ? t * 12 : t
  const r = emi(p, rt, months)

  const principalShare = r ? (p! / r.totalPayment) * 100 : 0

  return (
    <>
      <div className="page-head">
        <h1>EMI Calculator</h1>
        <p className="desc">Monthly instalment, total interest and repayment schedule for a loan.</p>
      </div>

      <div className="card">
        <div className="panel">
          <div className="fields">
            <div className="field">
              <span className="field-label" id="m-mode-label">I know the</span>
              <Segmented
                label="I know the"
                value={mode}
                onChange={setMode}
                options={[
                  { id: 'direct', label: 'Loan amount' },
                  { id: 'cost', label: 'Total cost & down payment' },
                ]}
              />
            </div>

            {mode === 'direct' ? (
              <Field money id="m-amt" label="Loan amount" unit={cur} value={amount} onChange={setAmount} placeholder="500000" />
            ) : (
              <>
                <Field money id="m-cost" label="Total cost (price)" unit={cur} value={totalCost} onChange={setTotalCost} placeholder="800000" />
                <div className="field">
                  <div className="field-row tenure">
                    {downUnit === 'amount' ? (
                      <Field money id="m-down" label="Down payment" unit={cur} value={downPayment} onChange={setDownPayment} placeholder="300000" allowZero />
                    ) : (
                      <Field id="m-down-pct" label="Down payment" unit="% of cost" value={downPercent} onChange={setDownPercent} placeholder="20" allowZero />
                    )}
                    <Segmented
                      label="Down payment as"
                      value={downUnit}
                      onChange={setDownUnit}
                      options={[
                        { id: 'amount', label: cur },
                        { id: 'percent', label: '%' },
                      ]}
                    />
                  </div>
                  {downUnit === 'percent' && pct !== null && cost !== null && (
                    <span className="pct-result" aria-live="polite">
                      {fmt.format(pct)}% of {cur}{money.format(cost)} = <strong>{cur}{money.format(down!)}</strong>
                    </span>
                  )}
                  {downUnit === 'percent' && pct !== null && cost === null && (
                    <span className="hint">Enter the total cost to see {fmt.format(pct)}% of it.</span>
                  )}
                  {downTooBig && (
                    <span className="error">
                      Down payment must be less than the total cost{downUnit === 'percent' ? ' (under 100%)' : ''}
                    </span>
                  )}
                </div>
                <p className={`loan-derived${derived !== null ? ' ready' : ''}`} aria-live="polite">
                  {derived !== null ? (
                    <>
                      Loan amount = {cur}{money.format(cost!)} − {cur}{money.format(down!)} ={' '}
                      <strong>{cur}{money.format(derived)}</strong>
                      <span className="muted"> ({fmt.format((down! / cost!) * 100)}% down)</span>
                    </>
                  ) : (
                    'Loan amount = total cost − down payment'
                  )}
                </p>
              </>
            )}
            <Field id="m-rate" label="Interest rate (yearly)" unit="% p.a." value={rate} onChange={setRate} placeholder="9.5" allowZero />
            <div className="field">
              <div className="field-row tenure">
                <Field id="m-ten" label="Loan tenure" unit={tenureUnit} value={tenure} onChange={setTenure} placeholder={tenureUnit === 'years' ? '5' : '60'} />
                <Segmented
                  label="Tenure in"
                  value={tenureUnit}
                  onChange={setTenureUnit}
                  options={[
                    { id: 'years', label: 'Years' },
                    { id: 'months', label: 'Months' },
                  ]}
                />
              </div>
            </div>
          </div>

          <Result
            ready={r !== null}
            missing={missingOf([
              ...(mode === 'direct'
                ? ([['loan amount', p]] as [string, number | null][])
                : ([['total cost', cost], ['down payment (0 if none)', downTooBig ? null : downUnit === 'amount' ? down : pct]] as [string, number | null][])),
              ['interest rate', rt],
              ['tenure', t],
            ])}
          >
            {r && (
              <>
                <span className="label">Monthly EMI</span>
                <span className="big">{cur}{fmt.format(r.emi)}</span>
                <span className="sub">for {r.months} months</span>

                <div className="emi-split" aria-hidden="true">
                  <span className="principal" style={{ width: `${principalShare}%` }} />
                  <span className="interest" style={{ width: `${100 - principalShare}%` }} />
                </div>

                <dl className="emi-stats">
                  <div>
                    <dt><i className="dot principal" />Principal</dt>
                    <dd>{cur}{money.format(p!)}</dd>
                  </div>
                  <div>
                    <dt><i className="dot interest" />Total interest</dt>
                    <dd>{cur}{money.format(r.totalInterest)}</dd>
                  </div>
                  <div>
                    <dt>Total payment</dt>
                    <dd>{cur}{money.format(r.totalPayment)}</dd>
                  </div>
                </dl>
                {mode === 'cost' && cost !== null && down !== null && (() => {
                  const share = (down / cost) * 100
                  const level = downLevel(share)
                  return (
                    <div className={`down-rating ${level.id}`}>
                      <div className="down-head">
                        <span className="down-title">Down payment: {fmt.format(share)}%</span>
                        <span className={`down-badge ${level.id}`}>{level.label}</span>
                      </div>
                      <div className="gauge down-gauge" aria-hidden="true">
                        <div className="gauge-bar">
                          <span className="seg bad" style={{ width: '30%' }} />
                          <span className="seg good" style={{ width: '20%' }} />
                          <span className="seg great" style={{ width: '50%' }} />
                        </div>
                        <span className="gauge-marker" style={{ left: `${Math.min(share, 100)}%` }} />
                        <div className="gauge-ticks">
                          {[0, 30, 50, 100].map((t) => (
                            <span key={t} style={{ left: `${t}%` }}>{t}%</span>
                          ))}
                        </div>
                      </div>
                      <p className="down-note">
                        {level.note}
                        {level.id === 'bad' && (
                          <>
                            {' '}Aim for at least 30% ({cur}{money.format(cost * 0.3)}), which is{' '}
                            {cur}{money.format(cost * 0.3 - down)} more.
                          </>
                        )}
                      </p>
                    </div>
                  )
                })()}

                <code className="formula">EMI = P × r × (1+r)ⁿ ÷ ((1+r)ⁿ − 1)</code>
              </>
            )}
          </Result>

          {r && (
            <div className="schedule">
              <button
                type="button"
                className="btn"
                aria-expanded={showSchedule}
                onClick={() => setShowSchedule((s) => !s)}
              >
                {showSchedule ? 'Hide' : 'Show'} yearly repayment schedule
              </button>
              {showSchedule && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Year</th>
                        <th scope="col">Principal paid</th>
                        <th scope="col">Interest paid</th>
                        <th scope="col">Balance left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.schedule.map((row) => (
                        <tr key={row.year}>
                          <td>{row.year}</td>
                          <td>{cur}{money.format(row.principal)}</td>
                          <td>{cur}{money.format(row.interest)}</td>
                          <td>{cur}{money.format(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
