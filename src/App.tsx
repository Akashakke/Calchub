import { useEffect, useState } from 'react'
import MileageCalculator from './components/MileageCalculator'
import CostEstimator from './components/CostEstimator'
import BmiCalculator from './components/BmiCalculator'
import EmiCalculator from './components/EmiCalculator'
import DepositCalculator from './components/DepositCalculator'
import TimeZoneConverter from './components/TimeZoneConverter'
import UnitConverter from './components/UnitConverter'
import FeedbackWidget from './components/FeedbackWidget'
import './App.css'

const APP_NAME = 'CalcHub'

type View = 'mileage' | 'estimator' | 'emi' | 'deposits' | 'bmi' | 'timezone' | 'units'

const GROUPS: { title: string; items: { id: View; label: string; icon: string }[] }[] = [
  {
    title: 'Travel',
    items: [
      { id: 'mileage', label: 'Mileage Calculator', icon: '⛽' },
      { id: 'estimator', label: 'Trip Cost Estimator', icon: '🧾' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { id: 'emi', label: 'EMI Calculator', icon: '🏦' },
      { id: 'deposits', label: 'FD & RD Calculator', icon: '💰' },
    ],
  },
  { title: 'Health', items: [{ id: 'bmi', label: 'BMI Calculator', icon: '⚖️' }] },
  {
    title: 'Utilities',
    items: [
      { id: 'timezone', label: 'Time Zone Converter', icon: '🕒' },
      { id: 'units', label: 'Unit Converter', icon: '📏' },
    ],
  },
]

const CURRENCIES = ['₹', '$', '€', '£']

function App() {
  const [view, setView] = useState<View>('mileage')
  const [cur, setCur] = useState('₹')
  // Phones: the sidebar is an icon rail; this opens it to show names.
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className="layout">
      <aside id="sidebar" className={navOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <button
            type="button"
            className="nav-toggle"
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            aria-controls="sidebar"
            onClick={() => setNavOpen((o) => !o)}
          >
            {navOpen ? '✕' : '☰'}
          </button>
          <span className="brand-mark" aria-hidden="true">∑</span>
          <span className="brand-name">{APP_NAME}</span>
        </div>
        <nav className="side-nav" aria-label="Calculators">
          {GROUPS.map((g) => (
            <div key={g.title} className="nav-group">
              <span className="nav-title">{g.title}</span>
              {g.items.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={view === v.id ? 'active' : ''}
                  aria-current={view === v.id ? 'page' : undefined}
                  title={v.label}
                  onClick={() => {
                    setView(v.id)
                    setNavOpen(false)
                  }}
                >
                  <span className="nav-icon" aria-hidden="true">{v.icon}</span>
                  <span className="nav-label">{v.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <label className="currency">
          <span className="currency-label">Currency</span>
          <select value={cur} onChange={(e) => setCur(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </aside>
      {navOpen && <div className="nav-backdrop" aria-hidden="true" onClick={() => setNavOpen(false)} />}

      <main className="content">
        {/* All stay mounted so switching keeps what you typed. */}
        <div hidden={view !== 'mileage'}>
          <MileageCalculator cur={cur} />
        </div>
        <div hidden={view !== 'estimator'}>
          <CostEstimator cur={cur} />
        </div>
        <div hidden={view !== 'emi'}>
          <EmiCalculator cur={cur} />
        </div>
        <div hidden={view !== 'deposits'}>
          <DepositCalculator cur={cur} />
        </div>
        <div hidden={view !== 'bmi'}>
          <BmiCalculator />
        </div>
        <div hidden={view !== 'timezone'}>
          <TimeZoneConverter />
        </div>
        <div hidden={view !== 'units'}>
          <UnitConverter />
        </div>
      </main>

      <FeedbackWidget />
    </div>
  )
}

export default App
