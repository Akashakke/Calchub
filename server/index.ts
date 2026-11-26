/**
 * CalcHub backend: feedback API + static hosting of the built app.
 * Built-in Node modules only. Run with: node --env-file=.env server/index.ts
 */
import http from 'node:http'
import { appendFile, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.ts'
import { sendMail, SmtpError } from './smtp.ts'

const config = loadConfig()
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const FEEDBACK_LOG = path.join(ROOT, 'server', 'feedback.jsonl')

const MAX_BODY = 16 * 1024
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---- helpers ---------------------------------------------------------------

function json(res: http.ServerResponse, status: number, body: unknown) {
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
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function clientIp(req: http.IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown'
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

async function handleFeedback(req: http.IncomingMessage, res: http.ServerResponse) {
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

  const ip = clientIp(req)
  if (rateLimited(ip)) {
    return json(res, 429, { ok: false, error: 'Too many messages. Please try again in a few minutes.' })
  }

  const entry = { at: new Date().toISOString(), ip, ...result, emailed: false }

  if (!config.smtp) {
    await appendFile(FEEDBACK_LOG, JSON.stringify(entry) + '\n')
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
    const detail = err instanceof SmtpError || err instanceof Error ? err.message : String(err)
    console.error('[feedback] email failed:', detail)
    json(res, 502, { ok: false, error: "Couldn't send feedback right now. Please try again later." })
  } finally {
    await appendFile(FEEDBACK_LOG, JSON.stringify(entry) + '\n').catch((e) =>
      console.error('[feedback] could not write log:', e),
    )
  }
}

// ---- static files (production) ---------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

async function serveStatic(urlPath: string, res: http.ServerResponse) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  let file = path.join(DIST, path.normalize(decoded))
  if (!file.startsWith(DIST)) return json(res, 403, { ok: false, error: 'Forbidden' })
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html')
  } catch {
    file = path.join(DIST, 'index.html') // single-page app fallback
  }
  try {
    const data = await readFile(file)
    const cache = file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': cache })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found. Run "bun run build" first, or use "bun run dev" during development.')
  }
}

// ---- server -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/'
  try {
    if (url === '/api/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, email: config.smtp ? 'configured' : 'not configured' })
    }
    if (url === '/api/feedback') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' })
      return await handleFeedback(req, res)
    }
    if (url.startsWith('/api/')) return json(res, 404, { ok: false, error: 'Not found' })
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(url, res)
    json(res, 405, { ok: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('[server] unexpected error:', err)
    if (!res.headersSent) json(res, 500, { ok: false, error: 'Something went wrong' })
  }
})

server.listen(config.port, () => {
  console.log(`CalcHub server on http://localhost:${config.port}`)
  if (config.missing.length) {
    console.warn(`[config] Email disabled. Missing in .env: ${config.missing.join(', ')}`)
    console.warn('[config] Feedback will be saved to server/feedback.jsonl until these are set.')
  } else {
    console.log(`[config] Feedback emails go to ${config.mailTo} via ${config.smtp!.host}:${config.smtp!.port}`)
  }
})
