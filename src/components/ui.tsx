/* eslint-disable react-refresh/only-export-components */
import { useLayoutEffect, useRef } from 'react'
import { nonNegative, positive } from '../lib/fuel'

interface FieldProps {
  id: string
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Accept 0 as a valid value (e.g. 0% interest, 0 inches). */
  allowZero?: boolean
  /** Money amount: shows thousands separators while typing (8,00,000). `value` stays a plain number string. */
  money?: boolean
}

// The user's own number style, e.g. "8,00,000.5" (India) or "800,000.5" (US).
const numParts = new Intl.NumberFormat().formatToParts(1000000.5)
const DECIMAL = numParts.find((p) => p.type === 'decimal')?.value ?? '.'
const intFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

/** Typed text → plain number string ("8,00,000.5" → "800000.5"). Keeps only digits and one decimal point. */
function toRaw(text: string): string {
  let out = ''
  let seenDot = false
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') out += ch
    else if (ch === DECIMAL && !seenDot) {
      out += '.'
      seenDot = true
    }
  }
  return out
}

/** Plain number string → text with thousands separators ("800000.5" → "8,00,000.5"). */
function toDisplay(raw: string): string {
  if (!raw) return ''
  const [int, frac] = raw.split('.')
  const grouped = int ? intFormat.format(BigInt(int)) : ''
  return frac !== undefined ? `${grouped || '0'}${DECIMAL}${frac}` : grouped
}

/** Number of digits / decimal points in the first `pos` characters (ignores separators). */
const significantBefore = (text: string, pos: number) => toRaw(text.slice(0, pos)).length

export function Field({ id, label, unit, value, onChange, placeholder, allowZero, money }: FieldProps) {
  const parsed = allowZero ? nonNegative(value) : positive(value)
  const invalid = value.trim() !== '' && parsed === null
  const inputRef = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  // After commas are added or removed, put the cursor back after the same digit.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!money || !el || caret.current === null || document.activeElement !== el) return
    const want = caret.current
    caret.current = null
    let pos = 0
    for (let seen = 0; pos < el.value.length && seen < want; pos++) {
      if (toRaw(el.value[pos]) !== '') seen++
    }
    el.setSelectionRange(pos, pos)
  })

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap${invalid ? ' invalid' : ''}`}>
        {money ? (
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={toDisplay(value)}
            placeholder={placeholder && toDisplay(toRaw(placeholder))}
            onChange={(e) => {
              caret.current = significantBefore(e.target.value, e.target.selectionStart ?? e.target.value.length)
              onChange(toRaw(e.target.value))
            }}
          />
        ) : (
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <span className="unit">{unit}</span>
      </div>
      {invalid && (
        <span className="error">{allowZero ? 'Enter 0 or more' : 'Enter a number greater than 0'}</span>
      )}
    </div>
  )
}

export function Result({
  ready,
  missing,
  children,
}: {
  ready: boolean
  missing: string[]
  children: React.ReactNode
}) {
  return (
    <div className={`result${ready ? ' ready' : ''}`} aria-live="polite">
      {ready ? (
        children
      ) : (
        <p className="hint">
          Enter <strong>{missing.join(', ')}</strong> to see the result.
        </p>
      )}
    </div>
  )
}

export function missingOf(fields: [string, number | null][]) {
  return fields.filter(([, v]) => v === null).map(([name]) => name)
}

/** Two-option switch, e.g. Metric / Imperial. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
