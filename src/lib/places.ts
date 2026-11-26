import { allZones, canonicalZone, isValidZone } from './timezone'

export interface Place {
  /** What the user sees and searches for. */
  label: string
  zone: string
}

const E = 'America/New_York'
const C = 'America/Chicago'
const M = 'America/Denver'
const P = 'America/Los_Angeles'

/**
 * US states → time zone. States split across zones get one entry per part,
 * so e.g. "Tennessee" offers both Nashville (Central) and Knoxville (Eastern).
 */
const US_STATES: [string, string][] = [
  ['Alabama', C],
  ['Alaska', 'America/Anchorage'],
  ['Alaska – Aleutian Islands', 'America/Adak'],
  ['Arizona (no daylight saving)', 'America/Phoenix'],
  ['Arkansas', C],
  ['California', P],
  ['Colorado', M],
  ['Connecticut', E],
  ['Delaware', E],
  ['District of Columbia – Washington, D.C.', E],
  ['Florida – Miami, Orlando, Tampa (Eastern)', E],
  ['Florida – Pensacola, Panhandle (Central)', C],
  ['Georgia (US state) – Atlanta', E],
  ['Hawaii', 'Pacific/Honolulu'],
  ['Idaho – Boise, south (Mountain)', 'America/Boise'],
  ['Idaho – Coeur d’Alene, north (Pacific)', P],
  ['Illinois – Chicago', C],
  ['Indiana – Indianapolis, most of state (Eastern)', 'America/Indiana/Indianapolis'],
  ['Indiana – Gary, Evansville (Central)', C],
  ['Iowa', C],
  ['Kansas – Wichita, most of state (Central)', C],
  ['Kansas – far west (Mountain)', M],
  ['Kentucky – Louisville, Lexington (Eastern)', 'America/Kentucky/Louisville'],
  ['Kentucky – Bowling Green, Paducah (Central)', C],
  ['Louisiana – New Orleans', C],
  ['Maine', E],
  ['Maryland – Baltimore', E],
  ['Massachusetts – Boston', E],
  ['Michigan – Detroit, most of state (Eastern)', 'America/Detroit'],
  ['Michigan – Menominee, west Upper Peninsula (Central)', 'America/Menominee'],
  ['Minnesota – Minneapolis', C],
  ['Mississippi', C],
  ['Missouri – St. Louis, Kansas City', C],
  ['Montana', M],
  ['Nebraska – Omaha, most of state (Central)', C],
  ['Nebraska – far west (Mountain)', M],
  ['Nevada – Las Vegas', P],
  ['New Hampshire', E],
  ['New Jersey', E],
  ['New Mexico', M],
  ['New York', E],
  ['North Carolina – Charlotte, Raleigh', E],
  ['North Dakota – most of state (Central)', C],
  ['North Dakota – southwest (Mountain)', M],
  ['Ohio – Columbus, Cleveland', E],
  ['Oklahoma', C],
  ['Oregon – Portland, most of state (Pacific)', P],
  ['Oregon – Malheur County (Mountain)', 'America/Boise'],
  ['Pennsylvania – Philadelphia, Pittsburgh', E],
  ['Rhode Island', E],
  ['South Carolina', E],
  ['South Dakota – Sioux Falls, east (Central)', C],
  ['South Dakota – Rapid City, west (Mountain)', M],
  ['Tennessee – Nashville, Memphis (Central)', C],
  ['Tennessee – Knoxville, Chattanooga (Eastern)', E],
  ['Texas – Houston, Dallas, Austin (Central)', C],
  ['Texas – El Paso (Mountain)', M],
  ['Utah – Salt Lake City', M],
  ['Vermont', E],
  ['Virginia', E],
  ['Washington (US state) – Seattle', P],
  ['West Virginia', E],
  ['Wisconsin – Milwaukee', C],
  ['Wyoming', M],
]

/** Common names people search for that aren't obvious from IANA zone ids. */
const POPULAR: [string, string][] = [
  ['India – New Delhi, Mumbai, Bengaluru, Chennai (IST)', 'Asia/Kolkata'],
  ['United Kingdom – London', 'Europe/London'],
  ['UAE – Dubai, Abu Dhabi', 'Asia/Dubai'],
  ['Singapore', 'Asia/Singapore'],
  ['Japan – Tokyo', 'Asia/Tokyo'],
  ['China – Beijing, Shanghai', 'Asia/Shanghai'],
  ['Hong Kong', 'Asia/Hong_Kong'],
  ['Australia – Sydney, Melbourne', 'Australia/Sydney'],
  ['Australia – Brisbane', 'Australia/Brisbane'],
  ['Australia – Perth', 'Australia/Perth'],
  ['New Zealand – Auckland', 'Pacific/Auckland'],
  ['Canada – Toronto, Ottawa (Eastern)', 'America/Toronto'],
  ['Canada – Vancouver (Pacific)', 'America/Vancouver'],
  ['Germany – Berlin', 'Europe/Berlin'],
  ['France – Paris', 'Europe/Paris'],
  ['Saudi Arabia – Riyadh', 'Asia/Riyadh'],
  ['Qatar – Doha', 'Asia/Qatar'],
  ['Nepal – Kathmandu', 'Asia/Kathmandu'],
  ['Sri Lanka – Colombo', 'Asia/Colombo'],
  ['Bangladesh – Dhaka', 'Asia/Dhaka'],
  ['Pakistan – Karachi', 'Asia/Karachi'],
  ['Malaysia – Kuala Lumpur', 'Asia/Kuala_Lumpur'],
  ['South Africa – Johannesburg', 'Africa/Johannesburg'],
  ['Brazil – São Paulo', 'America/Sao_Paulo'],
  ['Mexico – Mexico City', 'America/Mexico_City'],
  ['UTC (Coordinated Universal Time)', 'UTC'],
]

/** "America/Indiana/Indianapolis" → "Indianapolis, Indiana (America)" */
function labelForZone(zone: string): string {
  const parts = zone.split('/').map((s) => s.replace(/_/g, ' '))
  if (parts.length === 1) return parts[0]
  const city = parts[parts.length - 1]
  const rest = parts.slice(0, -1).reverse().join(', ')
  return `${city} (${rest}) – ${zone}`
}

let cache: Place[] | null = null

/** Curated places first, then every IANA zone the browser knows. */
export function places(): Place[] {
  if (cache) return cache
  const curated = [
    ...POPULAR.map(([label, zone]) => ({ label, zone })),
    ...US_STATES.map(([label, zone]) => ({ label: `USA – ${label}`, zone })),
  ]
  const seen = new Set<string>()
  const zones = allZones()
    .map(canonicalZone)
    .filter((zone) => !seen.has(zone) && seen.add(zone))
    .map((zone) => ({ label: labelForZone(zone), zone }))
  cache = [...curated, ...zones]
  return cache
}

/**
 * Places matching a search, best first. Every word typed must appear in the
 * label or zone id. Matches at the start of a word ("lon" → London) rank above
 * matches mid-word, and within each group the popular/US-state names come first
 * because they're listed first in places().
 */
export function searchPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase()
  if (!q) return places()
  const words = q.split(/\s+/)
  const wordStart = new RegExp(`(^|[\\s(–,/-])${escapeRe(words[0])}`)
  const scored: { p: Place; score: number; i: number }[] = []
  places().forEach((p, i) => {
    const hay = `${p.label} ${p.zone.replace(/_/g, ' ')}`.toLowerCase()
    if (!words.every((w) => hay.includes(w))) return
    scored.push({ p, score: wordStart.test(p.label.toLowerCase()) ? 0 : 1, i })
  })
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((s) => s.p)
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Finds a place by its exact label (case-insensitive) or by any valid IANA id. */
export function findPlace(text: string): Place | null {
  const q = text.trim().toLowerCase()
  if (!q) return null
  const found = places().find((p) => p.label.toLowerCase() === q) ?? places().find((p) => p.zone.toLowerCase() === q)
  if (found) return found
  const raw = text.trim()
  return isValidZone(raw) ? { label: raw, zone: canonicalZone(raw) } : null
}

/** The best label to show for a zone (prefers the curated name). */
export function labelFor(zone: string): string {
  const z = canonicalZone(zone)
  return places().find((p) => p.zone === z)?.label ?? z
}

/**
 * Readable name for sentences:
 * "USA – Tennessee – Nashville, Memphis (Central)" → "Tennessee – Nashville, Memphis (Central)"
 * "Kolkata (Asia) – Asia/Kolkata" → "Kolkata (Asia)"
 */
export function displayName(label: string, zone: string): string {
  return label.replace(/^USA – /, '').replace(` – ${zone}`, '')
}
