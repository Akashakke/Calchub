import { useEffect, useId, useRef, useState } from 'react'
import { findPlace, searchPlaces } from '../lib/places'
import { formatTime12 } from '../lib/timezone'

interface Props {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

/** Bolds the parts of `text` that match any typed word. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return <>{text}</>
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>,
      )}
    </>
  )
}

/**
 * Search box with a custom suggestions dropdown (ARIA combobox pattern).
 * Opens below the input, fixed height with scrolling, full keyboard support.
 */
export default function PlacePicker({ id, label, value, onChange, placeholder }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  // Until the user types, show every place (not just the one already selected).
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = open ? searchPlaces(query ?? '') : []
  const invalid = !open && value.trim() !== '' && findPlace(value) === null

  // Keep the highlighted option visible while moving with the arrow keys.
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.children[active] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function openList() {
    setNow(Date.now())
    setQuery(null)
    setActive(0)
    setOpen(true)
  }

  function choose(text: string) {
    onChange(text)
    setOpen(false)
    setQuery(null)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      openList()
      return
    }
    if (!open) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => Math.min(a + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        break
      case 'PageDown':
        e.preventDefault()
        setActive((a) => Math.min(a + 8, results.length - 1))
        break
      case 'PageUp':
        e.preventDefault()
        setActive((a) => Math.max(a - 8, 0))
        break
      case 'Enter':
        if (results[active]) {
          e.preventDefault()
          choose(results[active].label)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className="field combo">
      <label htmlFor={id}>{label}</label>
      {/* Anchor: the dropdown is positioned against this box, so it always opens below the input. */}
      <div className="combo-anchor">
      <div className={`input-wrap${invalid ? ' invalid' : ''}${open ? ' open' : ''}`}>
        <span className="unit lead" aria-hidden="true">🔍</span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            setQuery(e.target.value)
            setActive(0)
            if (!open) {
              setNow(Date.now())
              setOpen(true)
            }
          }}
          onFocus={(e) => {
            e.target.select()
            openList()
          }}
          onClick={() => !open && openList()}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {value && (
          <button
            type="button"
            className="icon-btn clear"
            aria-label={`Clear ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('')
              setQuery('')
              setActive(0)
              setOpen(true)
              inputRef.current?.focus()
            }}
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="combo-pop">
          {results.length ? (
            <>
              <ul ref={listRef} id={listId} role="listbox" aria-label={`${label} suggestions`} className="combo-list">
                {results.map((p, i) => (
                  <li
                    key={p.label}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? 'active' : undefined}
                    // mousedown, not click: fires before the input loses focus
                    onMouseDown={(e) => {
                      e.preventDefault()
                      choose(p.label)
                    }}
                    onMouseMove={() => i !== active && setActive(i)}
                  >
                    <span className="combo-label">
                      <Highlight text={p.label} query={query ?? ''} />
                    </span>
                    <span className="combo-time">{formatTime12(now, p.zone)}</span>
                  </li>
                ))}
              </ul>
              <div className="combo-foot" aria-hidden="true">
                {results.length} place{results.length === 1 ? '' : 's'} · ↑↓ to move · Enter to pick
              </div>
            </>
          ) : (
            <div className="combo-empty">No places match “{query}”. Try a city, country or US state.</div>
          )}
        </div>
      )}
      </div>

      {invalid && <span className="error">Pick a place from the suggestions list</span>}
    </div>
  )
}
