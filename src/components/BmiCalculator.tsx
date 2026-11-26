import { useState } from 'react'
import { bmi, CATEGORIES, CM_PER_INCH, KG_PER_LB } from '../lib/bmi'
import { nonNegative, positive } from '../lib/fuel'
import { fmt } from '../lib/format'
import { Field, Result, Segmented, missingOf } from './ui'

type Units = 'metric' | 'imperial'

// The gauge shows BMI 15–40.
const GAUGE_MIN = 15
const GAUGE_MAX = 40
const pct = (v: number) => ((Math.min(Math.max(v, GAUGE_MIN), GAUGE_MAX) - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100

const one = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export default function BmiCalculator() {
  const [units, setUnits] = useState<Units>('metric')
  const [cm, setCm] = useState('')
  const [kg, setKg] = useState('')
  const [ft, setFt] = useState('')
  const [inch, setInch] = useState('')
  const [lb, setLb] = useState('')

  let heightCm: number | null
  let weightKg: number | null
  let missing: string[]
  if (units === 'metric') {
    heightCm = positive(cm)
    weightKg = positive(kg)
    missing = missingOf([['height', heightCm], ['weight', weightKg]])
  } else {
    const f = positive(ft)
    // Inches may be blank (= 0) when feet is given, e.g. exactly 6 ft.
    const i = inch.trim() === '' ? 0 : nonNegative(inch)
    heightCm = f !== null && i !== null ? (f * 12 + i) * CM_PER_INCH : null
    const w = positive(lb)
    weightKg = w === null ? null : w * KG_PER_LB
    missing = missingOf([['height (feet)', f], ['weight', w]])
  }

  const r = bmi(heightCm, weightKg)
  const toUnit = (kgValue: number) => (units === 'metric' ? kgValue : kgValue / KG_PER_LB)
  const wUnit = units === 'metric' ? 'kg' : 'lb'

  return (
    <>
      <div className="page-head">
        <h1>BMI Calculator</h1>
        <p className="desc">Body Mass Index for adults, from your height and weight.</p>
      </div>

      <div className="card">
        <div className="panel">
          <Segmented
            label="Units"
            value={units}
            onChange={setUnits}
            options={[
              { id: 'metric', label: 'Metric (cm, kg)' },
              { id: 'imperial', label: 'Imperial (ft, lb)' },
            ]}
          />

          <div className="fields">
            {units === 'metric' ? (
              <>
                <Field id="b-cm" label="Height" unit="cm" value={cm} onChange={setCm} placeholder="170" />
                <Field id="b-kg" label="Weight" unit="kg" value={kg} onChange={setKg} placeholder="65" />
              </>
            ) : (
              <>
                <div className="field-row">
                  <Field id="b-ft" label="Height" unit="ft" value={ft} onChange={setFt} placeholder="5" />
                  <Field id="b-in" label="&nbsp;" unit="in" value={inch} onChange={setInch} placeholder="7" allowZero />
                </div>
                <Field id="b-lb" label="Weight" unit="lb" value={lb} onChange={setLb} placeholder="143" />
              </>
            )}
          </div>

          <Result ready={r !== null} missing={missing}>
            {r && (
              <>
                <span className="label">Your BMI</span>
                <span className="big">{one.format(r.bmi)}</span>
                <span className={`bmi-badge ${r.category.id}`}>{r.category.label}</span>

                <div className="gauge" aria-hidden="true">
                  <div className="gauge-bar">
                    {CATEGORIES.map((c, idx) => {
                      const start = pct(Math.max(c.from, GAUGE_MIN))
                      const end = pct(CATEGORIES[idx + 1]?.from ?? GAUGE_MAX)
                      return <span key={c.id} className={`seg ${c.id}`} style={{ width: `${end - start}%` }} />
                    })}
                  </div>
                  <span className="gauge-marker" style={{ left: `${pct(r.bmi)}%` }} />
                  <div className="gauge-ticks">
                    {[18.5, 25, 30].map((t) => (
                      <span key={t} style={{ left: `${pct(t)}%` }}>{t}</span>
                    ))}
                  </div>
                </div>

                <span className="sub">
                  Healthy weight for your height: {fmt.format(toUnit(r.healthyKg[0]))}–
                  {fmt.format(toUnit(r.healthyKg[1]))} {wUnit}
                </span>
                <code className="formula">BMI = weight (kg) ÷ height (m)²</code>
              </>
            )}
          </Result>

          <p className="hint note">
            BMI is a screening guide for adults. It doesn't account for muscle mass, age, sex or
            ethnicity, so talk to a doctor for a health assessment.
          </p>
        </div>
      </div>
    </>
  )
}
