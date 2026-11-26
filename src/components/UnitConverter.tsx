import { useState } from 'react'
import { CATEGORIES, convert, formatValue, unitOf } from '../lib/units'
import { Result } from './ui'

interface Entry {
  value: string
  from: string
  to: string
}

/** Each category remembers its own value and units. */
const initial = (): Record<string, Entry> =>
  Object.fromEntries(CATEGORIES.map((c) => [c.id, { value: '1', from: c.defaults[0], to: c.defaults[1] }]))

/** Plain number, negatives allowed ("-40", "12.5"). */
function parseNumber(s: string): number | null {
  const t = s.trim()
  if (t === '' || t === '-' || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function UnitConverter() {
  const [catId, setCatId] = useState(CATEGORIES[0].id)
  const [entries, setEntries] = useState(initial)

  const cat = CATEGORIES.find((c) => c.id === catId)!
  const { value, from: fromId, to: toId } = entries[catId]
  const from = unitOf(cat, fromId)
  const to = unitOf(cat, toId)
  const update = (change: Partial<Entry>) =>
    setEntries((all) => ({ ...all, [catId]: { ...all[catId], ...change } }))

  const n = parseNumber(value)
  const error = value.trim() !== '' && n === null ? 'Enter a number' : n !== null ? cat.check(n, from) : null
  const ok = n !== null && error === null
  const result = ok ? convert(n, from, to) : null

  return (
    <>
      <div className="page-head">
        <h1>Unit Converter</h1>
        <p className="desc">Convert length, weight, temperature, area and more.</p>
      </div>

      <div className="card">
        <div className="unit-cats" role="tablist" aria-label="What to convert">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === catId}
              className={c.id === catId ? 'on' : ''}
              onClick={() => setCatId(c.id)}
            >
              <span aria-hidden="true">{c.icon}</span> {c.label}
            </button>
          ))}
        </div>

        <section className="panel" role="tabpanel" aria-label={cat.label}>
          <div className="unit-row">
            <div className="field">
              <label htmlFor="u-val">Value</label>
              <div className={`input-wrap${error ? ' invalid' : ''}`}>
                <input
                  id="u-val"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={value}
                  placeholder="1"
                  onChange={(e) => update({ value: e.target.value.replace(/[^\d.\-eE]/g, '') })}
                />
                <span className="unit">{from.symbol}</span>
              </div>
              {error && <span className="error">{error}</span>}
            </div>

            <div className="field">
              <label htmlFor="u-from">From</label>
              <select id="u-from" className="tz-input" value={from.id} onChange={(e) => update({ from: e.target.value })}>
                {cat.units.map((u) => (
                  <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn unit-swap"
              aria-label="Swap units"
              title="Swap units"
              onClick={() => update({ from: to.id, to: from.id })}
            >
              ⇄
            </button>

            <div className="field">
              <label htmlFor="u-to">To</label>
              <select id="u-to" className="tz-input" value={to.id} onChange={(e) => update({ to: e.target.value })}>
                {cat.units.map((u) => (
                  <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
                ))}
              </select>
            </div>
          </div>

          <Result ready={result !== null} missing={['a value']}>
            {result !== null && (
              <>
                <span className="label">
                  {formatValue(n!)} {from.symbol} =
                </span>
                <span className="big">
                  {formatValue(result)} <span className="unit-big">{to.symbol}</span>
                </span>
                {from.id !== to.id && (
                  <span className="sub">
                    1 {from.symbol} = {formatValue(convert(1, from, to))} {to.symbol}
                  </span>
                )}

                <ul className="unit-all" aria-label={`${formatValue(n!)} ${from.symbol} in every unit`}>
                  {cat.units
                    .filter((u) => u.id !== from.id)
                    .map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className={u.id === to.id ? 'on' : ''}
                          aria-pressed={u.id === to.id}
                          onClick={() => update({ to: u.id })}
                        >
                          <span className="unit-name">{u.label}</span>
                          <span className="unit-val">
                            {formatValue(convert(n!, from, u))} {u.symbol}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </Result>

          {cat.note && <p className="hint note">{cat.note}</p>}
        </section>
      </div>
    </>
  )
}
