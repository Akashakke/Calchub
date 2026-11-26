import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadConfig } from '../server/config.ts'
import { handleFeedback, json } from '../server/feedback.ts'

export default async function feedback(req: IncomingMessage, res: ServerResponse) {
  const forwardedFor = req.headers['x-vercel-forwarded-for']
  const ip = typeof forwardedFor === 'string' ? forwardedFor : req.socket.remoteAddress ?? 'unknown'
  try {
    await handleFeedback(req, res, loadConfig(), ip)
  } catch (err) {
    console.error('[feedback] unexpected error:', err)
    if (!res.headersSent) json(res, 500, { ok: false, error: 'Something went wrong' })
  }
}
