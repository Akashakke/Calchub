/** Time zone maths using only the built-in Intl API (IANA zone names like "Asia/Kolkata"). */

/** Old zone names some systems still report → current IANA names. */
const LEGACY: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Pacific/Truk': 'Pacific/Chuuk',
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  'Etc/UTC': 'UTC',
  'Etc/GMT': 'UTC',
}

export function canonicalZone(zone: string): string {
  return LEGACY[zone] ?? zone
}

export function systemZone(): string {
  return canonicalZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
}

export function allZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC']
  }
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

const partsCache = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(zone: string) {
  let f = partsCache.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsCache.set(zone, f)
  }
  return f
}

export interface WallTime {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
}

/** The local wall-clock time in `zone` at a given instant. */
export function wallTimeAt(instant: number, zone: string): WallTime {
  const p: Record<string, number> = {}
  for (const part of partsFormatter(zone).formatToParts(instant)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute }
}

/** Minutes the zone is ahead of UTC at that instant (e.g. +330 for India). */
export function offsetMinutes(instant: number, zone: string): number {
  const w = wallTimeAt(instant, zone)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute)
  const floored = Math.floor(instant / 60000) * 60000
  return Math.round((asUtc - floored) / 60000)
}

const DAY = 86_400_000

function sameWall(a: WallTime, b: WallTime) {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute
}

export type WallTimeKind =
  /** Normal: this local time happens exactly once. */
  | 'ok'
  /** Clocks jumped forward over this time (e.g. 2:30 AM on US spring-forward day). */
  | 'skipped'
  /** Clocks went back, so this time happens twice; the first one is used. */
  | 'repeated'

export interface ResolvedTime {
  instant: number
  kind: WallTimeKind
  /** For 'skipped': how far the time was moved forward, in minutes (usually 60). */
  shiftMinutes: number
}

/**
 * Converts "this date and time in this zone" to an exact instant, handling daylight saving.
 * - A time that doesn't exist (clocks jumped forward) moves forward by the jump: 2:30 AM → 3:30 AM.
 * - A time that happens twice (clocks went back) resolves to the first occurrence.
 */
export function resolveWallTime(w: WallTime, zone: string): ResolvedTime {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute)
  // Offsets in force a day before, at, and a day after cover both sides of any DST change.
  const offsets = [...new Set([guess - DAY, guess, guess + DAY].map((t) => offsetMinutes(t, zone)))]
  const valid = offsets
    .map((off) => guess - off * 60000)
    .filter((t) => sameWall(wallTimeAt(t, zone), w))
    .sort((a, b) => a - b)

  if (valid.length) {
    return { instant: valid[0], kind: valid.length > 1 && valid[1] !== valid[0] ? 'repeated' : 'ok', shiftMinutes: 0 }
  }

  // Skipped time: read it with the offset from BEFORE the jump, which lands after the jump.
  const before = offsetMinutes(guess - DAY, zone)
  const after = offsetMinutes(guess + DAY, zone)
  return { instant: guess - before * 60000, kind: 'skipped', shiftMinutes: after - before }
}

/** Instant (to the minute) when `zone` changes its UTC offset between `lo` and `hi`. */
function findChange(zone: string, lo: number, hi: number): number {
  const startOffset = offsetMinutes(lo, zone)
  while (hi - lo > 60_000) {
    const mid = lo + Math.floor((hi - lo) / 2 / 60_000) * 60_000
    if (offsetMinutes(mid, zone) === startOffset) lo = mid
    else hi = mid
  }
  return hi
}

/**
 * Every daylight-saving change (clock jump) in the given zones within the next
 * `days` days, sorted. Steps a day at a time, then narrows each change to the minute.
 */
export function upcomingTransitions(zones: string[], from = Date.now(), days = 366): number[] {
  const found = new Set<number>()
  for (const zone of new Set(zones)) {
    let prev = offsetMinutes(from, zone)
    for (let d = 1; d <= days; d++) {
      const t = from + d * DAY
      const off = offsetMinutes(t, zone)
      if (off !== prev) found.add(findChange(zone, t - DAY, t))
      prev = off
    }
  }
  return [...found].sort((a, b) => a - b)
}

export function instantFromWallTime(w: WallTime, zone: string): number {
  return resolveWallTime(w, zone).instant
}

const time12Cache = new Map<string, Intl.DateTimeFormat>()

/** "7:30 PM" */
export function formatTime12(instant: number, zone: string): string {
  let f = time12Cache.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true })
    time12Cache.set(zone, f)
  }
  return f.format(instant)
}

/** "Wed, 26 Nov 2026" */
export function formatDate(instant: number, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(instant)
}

/**
 * "CST", "IST", "BST", "AEST"…, or "GMT+5:45" when there's no common abbreviation.
 * Each English locale only knows its own region's abbreviations, so try several.
 */
export function zoneAbbreviation(instant: number, zone: string): string {
  for (const locale of ['en-US', 'en-IN', 'en-GB', 'en-AU']) {
    const part = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(instant)
      .find((p) => p.type === 'timeZoneName')
    if (part && !/^(GMT|UTC)[+-]/.test(part.value)) return part.value
  }
  return formatOffset(offsetMinutes(instant, zone))
}

/** "+5:30" → "GMT+5:30" */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return 'GMT'
  const sign = minutes > 0 ? '+' : '−'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

/** "10 h 30 m behind" / "same time" */
export function describeDifference(diffMinutes: number): string {
  if (diffMinutes === 0) return 'Same time'
  const abs = Math.abs(diffMinutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const span = [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ')
  return `${span} ${diffMinutes > 0 ? 'ahead' : 'behind'}`
}

/** Calendar-day difference between two wall times (−1 = previous day, +1 = next day). */
export function dayDifference(a: WallTime, b: WallTime): number {
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}
