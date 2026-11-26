/** Unit conversion: each unit converts to and from one base unit per category. */

export interface Unit {
  id: string
  label: string
  symbol: string
  toBase: (v: number) => number
  fromBase: (v: number) => number
}

export interface Category {
  id: string
  label: string
  icon: string
  units: Unit[]
  defaults: [from: string, to: string]
  /** Error message for an invalid value in `unit`, or null if fine. */
  check: (value: number, unit: Unit) => string | null
  note?: string
}

/** A unit that is `factor` base units (e.g. 1 km = 1000 m). */
const linear = (id: string, label: string, symbol: string, factor: number): Unit => ({
  id,
  label,
  symbol,
  toBase: (v) => v * factor,
  fromBase: (v) => v / factor,
})

const noNegative = (v: number) => (v < 0 ? 'Enter 0 or more' : null)

export const CATEGORIES: Category[] = [
  {
    id: 'length',
    label: 'Length',
    icon: '📏',
    defaults: ['km', 'mi'],
    check: noNegative,
    units: [
      linear('mm', 'Millimetre', 'mm', 0.001),
      linear('cm', 'Centimetre', 'cm', 0.01),
      linear('m', 'Metre', 'm', 1),
      linear('km', 'Kilometre', 'km', 1000),
      linear('in', 'Inch', 'in', 0.0254),
      linear('ft', 'Foot', 'ft', 0.3048),
      linear('yd', 'Yard', 'yd', 0.9144),
      linear('mi', 'Mile', 'mi', 1609.344),
      linear('nmi', 'Nautical mile', 'nmi', 1852),
    ],
  },
  {
    id: 'weight',
    label: 'Weight',
    icon: '⚖️',
    defaults: ['kg', 'lb'],
    check: noNegative,
    units: [
      linear('mg', 'Milligram', 'mg', 0.001),
      linear('g', 'Gram', 'g', 1),
      linear('kg', 'Kilogram', 'kg', 1000),
      linear('t', 'Tonne', 't', 1_000_000),
      linear('quintal', 'Quintal', 'quintal', 100_000),
      linear('tola', 'Tola', 'tola', 11.6638038),
      linear('oz', 'Ounce', 'oz', 28.349523125),
      linear('lb', 'Pound', 'lb', 453.59237),
      linear('st', 'Stone', 'st', 6350.29318),
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    icon: '🌡️',
    defaults: ['c', 'f'],
    check: (v, u) => (u.toBase(v) < -273.15 ? 'That’s below absolute zero (−273.15 °C)' : null),
    units: [
      { id: 'c', label: 'Celsius', symbol: '°C', toBase: (v) => v, fromBase: (v) => v },
      { id: 'f', label: 'Fahrenheit', symbol: '°F', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      { id: 'k', label: 'Kelvin', symbol: 'K', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
  {
    id: 'area',
    label: 'Area',
    icon: '📐',
    defaults: ['sqft', 'sqm'],
    check: noNegative,
    note: 'Bigha, kanal and marla differ from state to state, so they are not included.',
    units: [
      linear('sqcm', 'Square centimetre', 'sq cm', 0.0001),
      linear('sqm', 'Square metre', 'sq m', 1),
      linear('sqkm', 'Square kilometre', 'sq km', 1_000_000),
      linear('sqin', 'Square inch', 'sq in', 0.00064516),
      linear('sqft', 'Square foot', 'sq ft', 0.09290304),
      linear('sqyd', 'Square yard (gaj)', 'sq yd', 0.83612736),
      linear('cent', 'Cent', 'cent', 435.6 * 0.09290304),
      linear('guntha', 'Guntha', 'guntha', 1089 * 0.09290304),
      linear('ground', 'Ground', 'ground', 2400 * 0.09290304),
      linear('acre', 'Acre', 'acre', 4046.8564224),
      linear('ha', 'Hectare', 'ha', 10_000),
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    icon: '🧪',
    defaults: ['l', 'galus'],
    check: noNegative,
    units: [
      linear('ml', 'Millilitre', 'ml', 0.001),
      linear('l', 'Litre', 'L', 1),
      linear('m3', 'Cubic metre', 'm³', 1000),
      linear('tsp', 'Teaspoon (US)', 'tsp', 0.00492892159375),
      linear('tbsp', 'Tablespoon (US)', 'tbsp', 0.01478676478125),
      linear('cup', 'Cup (US)', 'cup', 0.2365882365),
      linear('floz', 'Fluid ounce (US)', 'fl oz', 0.0295735295625),
      linear('galus', 'Gallon (US)', 'gal (US)', 3.785411784),
      linear('galuk', 'Gallon (UK)', 'gal (UK)', 4.54609),
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    icon: '🚗',
    defaults: ['kmh', 'mph'],
    check: noNegative,
    units: [
      linear('ms', 'Metres per second', 'm/s', 1),
      linear('kmh', 'Kilometres per hour', 'km/h', 1000 / 3600),
      linear('mph', 'Miles per hour', 'mph', 1609.344 / 3600),
      linear('kn', 'Knot', 'kn', 1852 / 3600),
    ],
  },
  {
    id: 'fuel',
    label: 'Fuel economy',
    icon: '⛽',
    defaults: ['kml', 'mpgus'],
    check: (v) => (v <= 0 ? 'Enter a number greater than 0' : null),
    note: 'L/100 km works the other way round: a lower number means better mileage.',
    units: [
      linear('kml', 'Kilometres per litre', 'km/L', 1),
      // Reciprocal: 5 L/100 km = 20 km/L.
      { id: 'l100', label: 'Litres per 100 km', symbol: 'L/100 km', toBase: (v) => 100 / v, fromBase: (v) => 100 / v },
      linear('mpgus', 'Miles per gallon (US)', 'mpg (US)', 1.609344 / 3.785411784),
      linear('mpguk', 'Miles per gallon (UK)', 'mpg (UK)', 1.609344 / 4.54609),
    ],
  },
]

export function unitOf(cat: Category, id: string): Unit {
  return cat.units.find((u) => u.id === id) ?? cat.units[0]
}

export function convert(value: number, from: Unit, to: Unit): number {
  return to.fromBase(from.toBase(value))
}

const plain = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 8 })
const sci = new Intl.NumberFormat('en-US', { notation: 'scientific', maximumSignificantDigits: 6 })

/** Readable number: grouped digits, or scientific notation when very large or tiny. */
export function formatValue(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) return sci.format(n).replace('E', ' × 10^')
  // Hide float noise such as 0.30480000000000004.
  return plain.format(Number(n.toPrecision(12)))
}
