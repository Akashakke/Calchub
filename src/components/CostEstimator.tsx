import { useState } from 'react'
import { checkExpense, totalExpenses, type Expense } from '../lib/expenses'
import { fmt } from '../lib/format'

let nextId = 1
const blank = (name = ''): Expense => ({ id: nextId++, name, min: '', max: '' })

const STARTERS = ['Fuel', 'Food', 'Stay', 'Tolls & parking']

export default function CostEstimator({ cur }: { cur: string }) {
  const [expenses, setExpenses] = useState<Expense[]>(() => STARTERS.map((n) => blank(n)))

  const update = (id: number, field: keyof Omit<Expense, 'id'>, value: string) =>
    setExpenses((list) => list.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  const remove = (id: number) => setExpenses((list) => list.filter((e) => e.id !== id))
  const add = () => setExpenses((list) => [...list, blank()])
  const reset = () => setExpenses(STARTERS.map((n) => blank(n)))

  const totals = totalExpenses(expenses)

  return (
    <>
      <div className="page-head">
        <h1>Trip Cost Estimator</h1>
        <p className="desc">
          List each expense with a minimum and maximum cost. Leave max blank for a fixed cost.
        </p>
      </div>

      <div className="card">
        <div className="panel">
          <div className="expense-head" aria-hidden="true">
            <span>Expense</span>
            <span>Min ({cur})</span>
            <span>Max ({cur})</span>
            <span />
          </div>

          <ul className="expenses">
            {expenses.map((e, i) => {
              const c = checkExpense(e)
              const label = e.name.trim() || `Expense ${i + 1}`
              return (
                <li key={e.id} className={c.error ? 'row invalid' : 'row'}>
                  <input
                    type="text"
                    className="name"
                    placeholder={`Expense ${i + 1}`}
                    aria-label={`Expense ${i + 1} name`}
                    value={e.name}
                    onChange={(ev) => update(e.id, 'name', ev.target.value)}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    placeholder="0"
                    aria-label={`${label} minimum cost`}
                    value={e.min}
                    onChange={(ev) => update(e.id, 'min', ev.target.value)}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    placeholder={e.min || '0'}
                    aria-label={`${label} maximum cost`}
                    value={e.max}
                    onChange={(ev) => update(e.id, 'max', ev.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${label}`}
                    title="Remove"
                    onClick={() => remove(e.id)}
                  >
                    ✕
                  </button>
                  {c.error && <span className="error row-error">{c.error}</span>}
                </li>
              )
            })}
          </ul>

          {expenses.length === 0 && <p className="hint empty">No expenses yet. Add one below.</p>}

          <div className="expense-actions">
            <button type="button" className="btn primary" onClick={add}>
              + Add expense
            </button>
            <button type="button" className="btn" onClick={reset}>
              Reset
            </button>
          </div>

          <div className={`totals${totals.counted ? ' ready' : ''}`} aria-live="polite">
            <div>
              <span className="label">Total minimum</span>
              <span className="big">{cur}{fmt.format(totals.min)}</span>
            </div>
            <div>
              <span className="label">Total maximum</span>
              <span className="big">{cur}{fmt.format(totals.max)}</span>
            </div>
          </div>
          <p className="hint totals-note">
            {totals.counted} expense{totals.counted === 1 ? '' : 's'} counted
            {totals.counted > 0 && <> · range {cur}{fmt.format(totals.max - totals.min)}</>}
            {totals.errors > 0 && (
              <span className="error"> · {totals.errors} row{totals.errors === 1 ? '' : 's'} skipped (fix errors)</span>
            )}
          </p>
        </div>
      </div>
    </>
  )
}
