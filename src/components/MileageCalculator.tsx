import { useState } from 'react'
import {
  fuelCost,
  fuelEfficiency,
  fuelRequired,
  litresFromSpend,
  positive,
} from '../lib/fuel'
import { fmt } from '../lib/format'
import { Field, Result, missingOf } from './ui'

type Tab = 'cost' | 'efficiency' | 'required'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'cost', label: 'Fuel Cost', icon: '💰' },
  { id: 'efficiency', label: 'Fuel Efficiency', icon: '📈' },
  { id: 'required', label: 'Fuel Required', icon: '⛽' },
]

function CostTab({ cur }: { cur: string }) {
  const [distance, setDistance] = useState('')
  const [mileage, setMileage] = useState('')
  const [price, setPrice] = useState('')
  const d = positive(distance)
  const m = positive(mileage)
  const p = positive(price)
  const r = fuelCost(d, m, p)

  return (
    <>
      <p className="desc">How much will this trip cost in fuel?</p>
      <div className="fields">
        <Field id="c-dist" label="Distance" unit="km" value={distance} onChange={setDistance} placeholder="300" />
        <Field id="c-mil" label="Vehicle mileage" unit="km/L" value={mileage} onChange={setMileage} placeholder="15" />
        <Field id="c-price" label="Fuel price" unit={`${cur}/L`} value={price} onChange={setPrice} placeholder="100" />
      </div>
      <Result ready={r !== null} missing={missingOf([['distance', d], ['mileage', m], ['fuel price', p]])}>
        {r && (
          <>
            <span className="label">Total fuel cost</span>
            <span className="big">{cur}{fmt.format(r.cost)}</span>
            <span className="sub">{fmt.format(r.litres)} L of fuel used</span>
            <code className="formula">({fmt.format(d!)} km ÷ {fmt.format(m!)} km/L) × {cur}{fmt.format(p!)}/L</code>
          </>
        )}
      </Result>
    </>
  )
}

function EfficiencyTab({ cur }: { cur: string }) {
  const [mode, setMode] = useState<'litres' | 'spend'>('litres')
  const [distance, setDistance] = useState('')
  const [litres, setLitres] = useState('')
  const [spent, setSpent] = useState('')
  const [price, setPrice] = useState('')
  const d = positive(distance)
  const l = positive(litres)
  const s = positive(spent)
  const p = positive(price)
  const used = mode === 'litres' ? l : litresFromSpend(s, p)
  const r = fuelEfficiency(d, used)
  const missing =
    mode === 'litres'
      ? missingOf([['distance', d], ['fuel used', l]])
      : missingOf([['distance', d], ['amount spent', s], ['fuel price', p]])

  return (
    <>
      <p className="desc">What mileage is your vehicle getting?</p>
      <div className="segmented" role="radiogroup" aria-label="What do you know?">
        <button type="button" role="radio" aria-checked={mode === 'litres'} className={mode === 'litres' ? 'on' : ''} onClick={() => setMode('litres')}>
          I know fuel used (L)
        </button>
        <button type="button" role="radio" aria-checked={mode === 'spend'} className={mode === 'spend' ? 'on' : ''} onClick={() => setMode('spend')}>
          I know amount spent
        </button>
      </div>
      <div className="fields">
        <Field id="e-dist" label="Distance travelled" unit="km" value={distance} onChange={setDistance} placeholder="450" />
        {mode === 'litres' ? (
          <Field id="e-lit" label="Fuel used" unit="L" value={litres} onChange={setLitres} placeholder="30" />
        ) : (
          <>
            <Field id="e-spent" label="Amount spent on fuel" unit={cur} value={spent} onChange={setSpent} placeholder="3000" />
            <Field id="e-price" label="Fuel price" unit={`${cur}/L`} value={price} onChange={setPrice} placeholder="100" />
          </>
        )}
      </div>
      <Result ready={r !== null} missing={missing}>
        {r && (
          <>
            <span className="label">Fuel efficiency</span>
            <span className="big">{fmt.format(r.kmPerL)} km/L</span>
            <span className="sub">{fmt.format(r.lPer100km)} L/100 km</span>
            <code className="formula">
              {mode === 'spend' && <>{cur}{fmt.format(s!)} ÷ {cur}{fmt.format(p!)}/L = {fmt.format(r.litres)} L → </>}
              {fmt.format(d!)} km ÷ {fmt.format(r.litres)} L
            </code>
          </>
        )}
      </Result>
    </>
  )
}

function RequiredTab({ cur }: { cur: string }) {
  const [distance, setDistance] = useState('')
  const [mileage, setMileage] = useState('')
  const [price, setPrice] = useState('')
  const d = positive(distance)
  const m = positive(mileage)
  const p = positive(price)
  const r = fuelRequired(d, m, p)

  return (
    <>
      <p className="desc">How much fuel do you need for this trip?</p>
      <div className="fields">
        <Field id="r-dist" label="Distance" unit="km" value={distance} onChange={setDistance} placeholder="600" />
        <Field id="r-mil" label="Vehicle mileage" unit="km/L" value={mileage} onChange={setMileage} placeholder="20" />
        <Field id="r-price" label="Fuel price (optional)" unit={`${cur}/L`} value={price} onChange={setPrice} placeholder="100" />
      </div>
      <Result ready={r !== null} missing={missingOf([['distance', d], ['mileage', m]])}>
        {r && (
          <>
            <span className="label">Fuel required</span>
            <span className="big">{fmt.format(r.litres)} L</span>
            {r.cost !== null && <span className="sub">≈ {cur}{fmt.format(r.cost)} at {cur}{fmt.format(p!)}/L</span>}
            <code className="formula">{fmt.format(d!)} km ÷ {fmt.format(m!)} km/L</code>
          </>
        )}
      </Result>
    </>
  )
}

export default function MileageCalculator({ cur }: { cur: string }) {
  const [tab, setTab] = useState<Tab>('cost')

  return (
    <>
      <div className="page-head">
        <h1>Mileage Calculator</h1>
        <p className="desc">Fuel cost, fuel efficiency and fuel required for a trip.</p>
      </div>
      <div className="card">
        <nav className="tabs" role="tablist">
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
          {tab === 'cost' && <CostTab cur={cur} />}
          {tab === 'efficiency' && <EfficiencyTab cur={cur} />}
          {tab === 'required' && <RequiredTab cur={cur} />}
        </section>
      </div>
    </>
  )
}
