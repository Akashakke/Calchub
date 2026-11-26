import { useState } from 'react'
import { fdMaturity, rdMaturity, type Compounding, type DepositResult } from '../lib/deposits'
import { nonNegative, positive } from '../lib/fuel'
import { fmt } from '../lib/format'
import { Field, Result, Segmented, missingOf } from './ui'

type Tab = 'fd' | 'rd'
type TenureUnit = 'years' | 'months'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'fd', label: 'Fixed Deposit (FD)', icon: '🔒' },
  { id: 'rd', label: 'Recurring Deposit (RD)', icon: '🔁' },
]

const COMPOUNDING: { value: Compounding; label: string }[] = [
  { value: 4, label: 'Quarterly (most banks)' },
  { value: 12, label: 'Monthly' },
  { value: 2, label: 'Half-yearly' },
  { value: 1, label: 'Yearly' },
]

const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

/** "5 years", "1 year 6 months", "9 months" */
function describeMonths(months: number) {
  const y = Math.floor(months / 12)
  const m = Math.round(months % 12)
  const part = (n: number, w: string) => (n ? `${n} ${w}${n === 1 ? '' : 's'}` : '')
  return [part(y, 'year'), part(m, 'month')].filter(Boolean).join(' ') || `${fmt.format(months)} months`
}

/** Tenure input with a Years / Months switch; returns months (or null). */
function useTenure() {
  const [tenure, setTenure] = useState('')
  const [unit, setUnit] = useState<TenureUnit>('years')
  const t = positive(tenure)
  const months = t === null ? null : unit === 'years' ? t * 12 : t
  return { tenure, setTenure, unit, setUnit, t, months }
}

function TenureField({ id, tenure: s }: { id: string; tenure: ReturnType<typeof useTenure> }) {
  return (
    <div className="field">
      <div className="field-row tenure">
        <Field
          id={id}
          label="Tenure"
          unit={s.unit}
          value={s.tenure}
          onChange={s.setTenure}
          placeholder={s.unit === 'years' ? '5' : '12'}
        />
        <Segmented
          label="Tenure in"
          value={s.unit}
          onChange={s.setUnit}
          options={[
            { id: 'years', label: 'Years' },
            { id: 'months', label: 'Months' },
          ]}
        />
      </div>
    </div>
  )
}

/** Big maturity figure + coloured invested/interest bar + stats, shared by FD and RD. */
function DepositSummary({ r, cur, investedLabel, formula }: {
  r: DepositResult
  cur: string
  investedLabel: string
  formula: string
}) {
  const investedShare = (r.invested / r.maturity) * 100
  return (
    <>
      <span className="label">Maturity amount</span>
      <span className="big">{cur}{money.format(r.maturity)}</span>
      <span className="sub">
        after {describeMonths(r.months)} · you earn {cur}{money.format(r.interest)} (
        {fmt.format((r.interest / r.invested) * 100)}% on what you put in)
      </span>

      <div className="emi-split" aria-hidden="true">
        <span className="principal" style={{ width: `${investedShare}%` }} />
        <span className="earned" style={{ width: `${100 - investedShare}%` }} />
      </div>

      <dl className="emi-stats">
        <div>
          <dt><i className="dot principal" />{investedLabel}</dt>
          <dd>{cur}{money.format(r.invested)}</dd>
        </div>
        <div>
          <dt><i className="dot earned" />Interest earned</dt>
          <dd>{cur}{money.format(r.interest)}</dd>
        </div>
        <div>
          <dt>Maturity amount</dt>
          <dd>{cur}{money.format(r.maturity)}</dd>
        </div>
      </dl>
      <code className="formula">{formula}</code>
    </>
  )
}

function FdTab({ cur }: { cur: string }) {
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [perYear, setPerYear] = useState<Compounding>(4)
  const tenure = useTenure()

  const p = positive(amount)
  const rt = nonNegative(rate)
  const r = fdMaturity(p, rt, tenure.months, perYear)

  return (
    <>
      <p className="desc">Put in one lump sum today and get it back with interest at the end.</p>
      <div className="fields">
        <Field money id="fd-amt" label="Deposit amount" unit={cur} value={amount} onChange={setAmount} placeholder="100000" />
        <Field id="fd-rate" label="Interest rate (yearly)" unit="% p.a." value={rate} onChange={setRate} placeholder="7" allowZero />
        <TenureField id="fd-ten" tenure={tenure} />
        <div className="field">
          <label htmlFor="fd-comp">Interest added (compounding)</label>
          <select
            id="fd-comp"
            className="tz-input"
            value={perYear}
            onChange={(e) => setPerYear(Number(e.target.value) as Compounding)}
          >
            {COMPOUNDING.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Result ready={r !== null} missing={missingOf([['deposit amount', p], ['interest rate', rt], ['tenure', tenure.t]])}>
        {r && (
          <DepositSummary
            r={r}
            cur={cur}
            investedLabel="Amount deposited"
            formula={`A = P × (1 + r/${perYear})^(${perYear} × years)`}
          />
        )}
      </Result>
    </>
  )
}

function RdTab({ cur }: { cur: string }) {
  const [monthly, setMonthly] = useState('')
  const [rate, setRate] = useState('')
  const tenure = useTenure()

  const m = positive(monthly)
  const rt = nonNegative(rate)
  const wholeMonths = tenure.months === null ? null : Math.round(tenure.months)
  const r = rdMaturity(m, rt, wholeMonths)

  return (
    <>
      <p className="desc">Save the same amount every month and get it all back with interest at the end.</p>
      <div className="fields">
        <Field money id="rd-amt" label="Monthly deposit" unit={`${cur}/month`} value={monthly} onChange={setMonthly} placeholder="5000" />
        <Field id="rd-rate" label="Interest rate (yearly)" unit="% p.a." value={rate} onChange={setRate} placeholder="6.5" allowZero />
        <TenureField id="rd-ten" tenure={tenure} />
      </div>
      <p className="hint note">Interest is compounded quarterly, as banks and post offices do for RDs.</p>

      <Result ready={r !== null} missing={missingOf([['monthly deposit', m], ['interest rate', rt], ['tenure', tenure.t]])}>
        {r && (
          <DepositSummary
            r={r}
            cur={cur}
            investedLabel={`Total deposited (${r.months} × ${cur}${money.format(m!)})`}
            formula="M = Σ R × (1 + r/400)^(months left ÷ 3)"
          />
        )}
      </Result>
    </>
  )
}

export default function DepositCalculator({ cur }: { cur: string }) {
  const [tab, setTab] = useState<Tab>('fd')

  return (
    <>
      <div className="page-head">
        <h1>FD &amp; RD Calculator</h1>
        <p className="desc">How much your Fixed Deposit or Recurring Deposit will grow to.</p>
      </div>
      <div className="card">
        <nav className="tabs two" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              <span aria-hidden="true">{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>

        <section className="panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {/* Both stay mounted so switching tabs keeps what you typed. */}
          <div hidden={tab !== 'fd'}>
            <FdTab cur={cur} />
          </div>
          <div hidden={tab !== 'rd'}>
            <RdTab cur={cur} />
          </div>
        </section>
      </div>
    </>
  )
}
