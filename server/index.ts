/**
 * CalcHub backend: feedback API + static hosting of the built app.
 * Built-in Node modules only. Run with: node --env-file=.env server/index.ts
 */
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.ts'
import { handleFeedback, json } from './feedback.ts'

const config = loadConfig()
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const FEEDBACK_LOG = path.join(ROOT, 'server', 'feedback.jsonl')

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
      return await handleFeedback(req, res, config, req.socket.remoteAddress ?? 'unknown', FEEDBACK_LOG)
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
