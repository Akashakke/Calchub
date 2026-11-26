import { useEffect, useState } from 'react'
import { displayName, findPlace, labelFor } from '../lib/places'
import {
  dayDifference,
  describeDifference,
  formatDate,
  formatTime12,
  resolveWallTime,
  offsetMinutes,
  systemZone,
  upcomingTransitions,
  wallTimeAt,
  zoneAbbreviation,
  type WallTime,
} from '../lib/timezone'
import { Segmented } from './ui'
import PlacePicker from './PlacePicker'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const pad = (n: number) => String(n).padStart(2, '0')

let nextId = 1

/** Zones whose clock jumps are scheduled on load: yours + the US mainland/Alaska. */
const DST_WATCH_ZONES = [
  systemZone(),
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
]

interface Target {
  id: number
  text: string
}

export default function TimeZoneConverter() {
  const [fromText, setFromText] = useState(() => labelFor(systemZone()))
  const [targets, setTargets] = useState<Target[]>([{ id: nextId++, text: '' }])

  // Live = follow the current time; editing date/time switches to a fixed time.
  const [live, setLive] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [manual, setManual] = useState<WallTime | null>(null)

  // Live clock: plain refresh every 15 s.
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [live])

  // Daylight-saving jumps: worked out ONCE, in the background after first load,
  // for your own zone and the US zones. Then one timer per jump refreshes the
  // clock at that exact moment (e.g. 1:59 AM → 3:00 AM). Nothing is re-checked per tick.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let queue: number[] = []
    const MAX_DELAY = 2_147_483_647 // setTimeout limit (~24.8 days)

    const scheduleNext = () => {
      queue = queue.filter((t) => t > Date.now())
      if (!queue.length) return
      timer = setTimeout(() => {
        if (Date.now() >= queue[0]) setNow(Date.now())
        scheduleNext() // a far-off jump just waits again; nothing is recomputed
      }, Math.min(queue[0] - Date.now() + 250, MAX_DELAY))
    }

    const start = setTimeout(() => {
      queue = upcomingTransitions(DST_WATCH_ZONES)
      scheduleNext()
    }, 0)

    return () => {
      clearTimeout(start)
      clearTimeout(timer)
    }
  }, [])

  const fromZone = findPlace(fromText)?.zone ?? null
  const resolved = fromZone && !live && manual ? resolveWallTime(manual, fromZone) : null
  const instant = fromZone ? (resolved ? resolved.instant : now) : null
  // The real local time: for a skipped time this is the moved-forward one (2:30 → 3:30).
  const wall: WallTime | null = fromZone && instant !== null ? wallTimeAt(instant, fromZone) : null

  const hour12 = wall ? ((wall.hour + 11) % 12) + 1 : 12
  const ampm: 'AM' | 'PM' = wall && wall.hour >= 12 ? 'PM' : 'AM'

  function edit(change: Partial<WallTime>) {
    if (!wall) return
    setManual({ ...wall, ...change })
    setLive(false)
  }
  const setHour12 = (h: number, period: 'AM' | 'PM') => edit({ hour: (h % 12) + (period === 'PM' ? 12 : 0) })

  function goLive() {
    setNow(Date.now())
    setManual(null)
    setLive(true)
  }

  function swap() {
    const first = targets[0]
    if (!first || !findPlace(first.text)) return
    // Keep the same moment in time, now expressed in the new "from" zone.
    if (!live && instant !== null) setManual(wallTimeAt(instant, findPlace(first.text)!.zone))
    setTargets((list) => [{ ...list[0], text: fromText }, ...list.slice(1)])
    setFromText(first.text)
  }

  const updateTarget = (id: number, text: string) =>
    setTargets((list) => list.map((t) => (t.id === id ? { ...t, text } : t)))
  const removeTarget = (id: number) => setTargets((list) => list.filter((t) => t.id !== id))
  const addTarget = () => setTargets((list) => [...list, { id: nextId++, text: '' }])

  const dateValue = wall ? `${wall.year}-${pad(wall.month)}-${pad(wall.day)}` : ''
  const fromName = fromZone ? displayName(findPlace(fromText)!.label, fromZone) : ''

  return (
    <>
      <div className="page-head">
        <h1>Time Zone Converter</h1>
        <p className="desc">
          See what time it is anywhere, now or at a time you choose. Search a city, country or US state.
        </p>
      </div>

      <div className="card allow-overflow">
        <div className="panel">
          <h2 className="section-title">From</h2>
          <div className="fields">
            <PlacePicker id="tz-from" label="Place" value={fromText} onChange={setFromText} placeholder="e.g. New Delhi" />

            <div className="tz-when">
              <div className="field">
                <label htmlFor="tz-date">Date</label>
                <input
                  id="tz-date"
                  className="tz-input"
                  type="date"
                  value={dateValue}
                  disabled={!wall}
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split('-').map(Number)
                    if (y && m && d) edit({ year: y, month: m, day: d })
                  }}
                />
              </div>
              <div className="field">
                <span className="field-label" id="tz-time-label">Time</span>
                <div className="tz-time" role="group" aria-labelledby="tz-time-label">
                  <select
                    aria-label="Hour"
                    className="tz-input"
                    value={hour12}
                    disabled={!wall}
                    onChange={(e) => setHour12(Number(e.target.value), ampm)}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span aria-hidden="true">:</span>
                  <select
                    aria-label="Minute"
                    className="tz-input"
                    value={wall?.minute ?? 0}
                    disabled={!wall}
                    onChange={(e) => edit({ minute: Number(e.target.value) })}
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>{pad(m)}</option>
                    ))}
                  </select>
                  <Segmented
                    label="AM or PM"
                    value={ampm}
                    onChange={(p) => setHour12(hour12, p)}
                    options={[
                      { id: 'AM', label: 'AM' },
                      { id: 'PM', label: 'PM' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {resolved?.kind === 'skipped' && manual && fromZone && instant !== null && (
              <p className="tz-notice warn" role="status">
                <strong>
                  {formatTime12(Date.UTC(2000, 0, 1, manual.hour, manual.minute), 'UTC')} doesn't exist
                </strong>{' '}
                in {fromName} on {formatDate(instant, fromZone)}: clocks jump forward{' '}
                {resolved.shiftMinutes === 60 ? '1 hour' : `${resolved.shiftMinutes} minutes`} for daylight saving.
                Adjusted automatically to <strong>{formatTime12(instant, fromZone)} {zoneAbbreviation(instant, fromZone)}</strong>.
              </p>
            )}
            {resolved?.kind === 'repeated' && fromZone && instant !== null && (
              <p className="tz-notice" role="status">
                <strong>{formatTime12(instant, fromZone)}</strong> happens twice in {fromName} on{' '}
                {formatDate(instant, fromZone)} because clocks go back. Using the first one (
                {zoneAbbreviation(instant, fromZone)}).
              </p>
            )}

            <div className="tz-live">
              {live ? (
                <span className="live-pill">
                  <i aria-hidden="true" /> Showing current time
                </span>
              ) : (
                <button type="button" className="btn" onClick={goLive}>
                  ↺ Use current time
                </button>
              )}
              <button type="button" className="btn" onClick={swap} disabled={!findPlace(targets[0]?.text ?? '')}>
                ⇅ Swap with first place
              </button>
            </div>
          </div>

          <h2 className="section-title to">To</h2>
          <ul className="tz-targets">
            {targets.map((t, i) => {
              const place = findPlace(t.text)
              let card: React.ReactNode = null
              if (place && instant !== null && fromZone && wall) {
                const tWall = wallTimeAt(instant, place.zone)
                const days = dayDifference(wall, tWall)
                const diff = offsetMinutes(instant, place.zone) - offsetMinutes(instant, fromZone)
                const name = displayName(place.label, place.zone)
                card = (
                  <div className="tz-result" aria-live="polite">
                    <div className="tz-time-big">
                      {formatTime12(instant, place.zone)}
                      <span className="tz-abbr">{zoneAbbreviation(instant, place.zone)}</span>
                    </div>
                    <div className="tz-date">
                      {formatDate(instant, place.zone)}
                      {days !== 0 && (
                        <span className={`tz-day ${days > 0 ? 'next' : 'prev'}`}>
                          {days > 0 ? 'Next day' : 'Previous day'}
                        </span>
                      )}
                    </div>
                    <div className="tz-diff">
                      {diff === 0 ? 'Same time as' : describeDifference(diff)} {fromName || 'your time'}
                    </div>
                    <p className="tz-sentence">
                      When it's <strong>{formatTime12(instant, fromZone)}</strong> in {fromName}, it's{' '}
                      <strong>{formatTime12(instant, place.zone)}</strong>
                      {days !== 0 && <> ({days > 0 ? 'next day' : 'previous day'})</>} in {name}.
                    </p>
                  </div>
                )
              }
              return (
                <li key={t.id} className="tz-target">
                  <div className="tz-target-head">
                    <PlacePicker
                      id={`tz-to-${t.id}`}
                      label={targets.length > 1 ? `Place ${i + 1}` : 'Place'}
                      value={t.text}
                      onChange={(v) => updateTarget(t.id, v)}
                      placeholder="e.g. Tennessee, London, Tokyo"
                    />
                    {targets.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove place ${i + 1}`}
                        title="Remove"
                        onClick={() => removeTarget(t.id)}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                  {card ?? (
                    <p className="hint tz-empty">
                      {fromZone ? 'Choose a place to see its time.' : 'Choose a valid "From" place first.'}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          <button type="button" className="btn primary" onClick={addTarget}>
            + Add another place
          </button>
        </div>
      </div>
    </>
  )
}
