import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadConfig } from '../server/config.ts'
import { json } from '../server/feedback.ts'

export default function health(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' })
  return json(res, 200, { ok: true, email: loadConfig().smtp ? 'configured' : 'not configured' })
}
