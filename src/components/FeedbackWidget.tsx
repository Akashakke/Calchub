import { useEffect, useRef, useState } from 'react'

const MAX_MESSAGE = 5000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STORE_KEY = 'calchub.feedback.contact'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; name: string; withEmail: boolean }
  | { kind: 'error'; message: string }

function loadContact(): { name: string; email: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
    return { name: String(saved.name ?? ''), email: String(saved.email ?? '') }
  } catch {
    return { name: '', email: '' }
  }
}

function saveContact(name: string, email: string) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ name, email }))
  } catch {
    /* storage unavailable: not important */
  }
}

/** Same rules as the server (server/index.ts → validate). */
function validate(name: string, email: string, message: string) {
  const errors: Partial<Record<'name' | 'email' | 'message', string>> = {}
  if (!name.trim()) errors.name = 'Please enter your name'
  else if (name.trim().length > 100) errors.name = 'Name is too long'
  // Email is optional; it's only used so the owner can reply.
  const mail = email.trim()
  if (mail && (!EMAIL_RE.test(mail) || mail.length > 254)) {
    errors.email = 'Enter a valid email, or leave it blank'
  }
  if (message.trim().length < 5) errors.message = 'Please write at least 5 characters'
  else if (message.trim().length > MAX_MESSAGE) errors.message = `Keep it under ${MAX_MESSAGE} characters`
  return errors
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [initial] = useState(loadContact)
  const [name, setName] = useState(initial.name)
  const [email, setEmail] = useState(initial.email)
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [touched, setTouched] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const panelRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLButtonElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const errors = validate(name, email, message)
  const show = (field: keyof typeof errors) => (touched ? errors[field] : undefined)

  const close = () => {
    setOpen(false)
    bubbleRef.current?.focus()
  }

  // Focus the first field when opening; close on Escape or outside click.
  useEffect(() => {
    if (!open) return
    firstFieldRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        bubbleRef.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !bubbleRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length) return

    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim(), website }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't send feedback. Please try again.")
      saveContact(name.trim(), email.trim())
      setStatus({ kind: 'sent', name: name.trim(), withEmail: email.trim() !== '' })
      setMessage('')
      setTouched(false)
    } catch (err) {
      const offline = err instanceof TypeError
      setStatus({
        kind: 'error',
        message: offline
          ? "Can't reach the feedback server. Check your connection and try again."
          : (err as Error).message,
      })
    }
  }

  const sending = status.kind === 'sending'

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          className="fb-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="fb-title"
        >
          <div className="fb-header">
            <div>
              <h2 id="fb-title">Send feedback</h2>
              <p>Ideas, bugs, anything. We read every message.</p>
            </div>
            <button type="button" className="fb-close" aria-label="Close feedback" onClick={close}>
              ✕
            </button>
          </div>

          {status.kind === 'sent' ? (
            <div className="fb-done" role="status">
              <div className="fb-check" aria-hidden="true">✓</div>
              <p>
                <strong>Thanks, {status.name}!</strong>
                <br />
                Your feedback was sent.
              </p>
              <p className="fb-hint">
                {status.withEmail
                  ? "We'll reply to your email if we need to."
                  : "You didn't add an email, so we won't be able to reply."}
              </p>
              <button type="button" className="btn" onClick={() => setStatus({ kind: 'idle' })}>
                Send another
              </button>
            </div>
          ) : (
            <form className="fb-form" onSubmit={submit} noValidate>
              <label htmlFor="fb-name">Name</label>
              <input
                ref={firstFieldRef}
                id="fb-name"
                type="text"
                autoComplete="name"
                maxLength={100}
                value={name}
                aria-invalid={!!show('name')}
                onChange={(e) => setName(e.target.value)}
              />
              {show('name') && <span className="error">{show('name')}</span>}

              <label htmlFor="fb-email">
                Email <span className="fb-optional">(optional)</span>
              </label>
              <input
                id="fb-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                placeholder="you@example.com"
                aria-describedby="fb-email-hint"
                aria-invalid={!!show('email')}
                onChange={(e) => setEmail(e.target.value)}
              />
              {show('email') ? (
                <span className="error">{show('email')}</span>
              ) : (
                <span id="fb-email-hint" className="fb-hint">
                  Want a reply? Add your email. Otherwise leave it blank. Your feedback will still be sent.
                </span>
              )}

              <label htmlFor="fb-message">Feedback</label>
              <textarea
                id="fb-message"
                rows={5}
                maxLength={MAX_MESSAGE}
                value={message}
                placeholder="What's working, what isn't, what you'd like to see…"
                aria-invalid={!!show('message')}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="fb-meta">
                {show('message') ? <span className="error">{show('message')}</span> : <span />}
                <span className="fb-count">
                  {message.length}/{MAX_MESSAGE}
                </span>
              </div>

              {/* Honeypot: hidden from people, bots tend to fill it. */}
              <input
                className="fb-hp"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />

              {status.kind === 'error' && (
                <p className="fb-error" role="alert">
                  {status.message}
                </p>
              )}

              <button type="submit" className="btn primary fb-submit" disabled={sending}>
                {sending ? 'Sending…' : status.kind === 'error' ? 'Retry' : 'Send feedback'}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        ref={bubbleRef}
        type="button"
        className={`fb-bubble${open ? ' open' : ''}`}
        aria-label={open ? 'Close feedback' : 'Send feedback'}
        aria-expanded={open}
        title="Feedback"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span aria-hidden="true">{open ? '✕' : '💬'}</span>
      </button>
    </>
  )
}
