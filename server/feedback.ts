import type http from 'node:http'
import { appendFile } from 'node:fs/promises'
import type { Config } from './config.ts'
import { sendMail } from './smtp.ts'

const MAX_BODY = 16 * 1024
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---- helpers ---------------------------------------------------------------

export function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Message is too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

interface Feedback {
  name: string
  email: string
  message: string
}

/** Same rules as the front end (src/components/FeedbackWidget.tsx). */
function validate(raw: unknown): Feedback | string {
  if (typeof raw !== 'object' || raw === null) return 'Invalid request'
  const r = raw as Record<string, unknown>
  const oneLine = (v: unknown) => (typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim() : '')
  const name = oneLine(r.name)
  const email = oneLine(r.email)
  const message = typeof r.message === 'string' ? r.message.trim() : ''

  if (!name || name.length > 100) return 'Please enter your name (up to 100 characters)'
  // Email is optional: it only lets the owner reply to the visitor.
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return 'Please enter a valid email address, or leave it blank'
  }
  if (message.length < 5) return 'Feedback must be at least 5 characters'
  if (message.length > 5000) return 'Feedback must be 5000 characters or fewer'
  return { name, email, message }
}

// ---- feedback endpoint ------------------------------------------------------

export async function handleFeedback(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: Config,
  ip: string,
  feedbackLog?: string,
) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' })
  let parsed: unknown
  try {
    parsed = JSON.parse(await readBody(req))
  } catch (err) {
    if (err instanceof HttpError) return json(res, err.status, { ok: false, error: err.message })
    return json(res, 400, { ok: false, error: 'Invalid request' })
  }

  // Honeypot: real users never see or fill the "website" field.
  if (typeof parsed === 'object' && parsed && (parsed as Record<string, unknown>).website) {
    return json(res, 200, { ok: true })
  }

  const result = validate(parsed)
  if (typeof result === 'string') return json(res, 400, { ok: false, error: result })

  if (rateLimited(ip)) {
    return json(res, 429, { ok: false, error: 'Too many messages. Please try again in a few minutes.' })
  }

  const entry = { at: new Date().toISOString(), ip, ...result, emailed: false }

  if (!config.smtp) {
    if (!feedbackLog) {
      return json(res, 503, { ok: false, error: "Feedback email isn't set up yet." })
    }
    await appendFile(feedbackLog, JSON.stringify(entry) + '\n')
    console.warn('[feedback] saved to file only: email is not configured')
    return json(res, 503, { ok: false, error: "Feedback email isn't set up yet. Your message was saved." })
  }

  const hasEmail = result.email !== ''
  try {
    await sendMail(config.smtp, {
      from: config.mailFrom, // sender: the logged-in Gmail account
      fromName: 'CalcHub Feedback',
      to: config.mailTo, // receiver: the owner's inbox
      replyTo: hasEmail ? result.email : undefined, // visitor, only if they gave an email
      subject: `CalcHub feedback from ${result.name}`,
      text: [
        `Name:  ${result.name}`,
        `Email: ${hasEmail ? result.email : '(not provided, so you can’t reply)'}`,
        `Time:  ${entry.at}`,
        '',
        result.message,
        '',
        '--',
        hasEmail
          ? 'Sent from the CalcHub feedback form. Reply to this email to answer them directly.'
          : 'Sent from the CalcHub feedback form.',
      ].join('\n'),
    })
    entry.emailed = true
    console.log(`[feedback] emailed: ${result.name} ${hasEmail ? `<${result.email}>` : '(no email)'}`)
    json(res, 200, { ok: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[feedback] email failed:', detail)
    json(res, 502, { ok: false, error: "Couldn't send feedback right now. Please try again later." })
  } finally {
    if (feedbackLog) {
      await appendFile(feedbackLog, JSON.stringify(entry) + '\n').catch((e) =>
        console.error('[feedback] could not write log:', e),
      )
    }
  }
}
