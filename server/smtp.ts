/**
 * Minimal SMTP client built on Node's own `net` and `tls` modules.
 * Supports implicit TLS (port 465) and STARTTLS (port 587) with AUTH LOGIN.
 */
import net from 'node:net'
import tls from 'node:tls'
import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'

export interface SmtpOptions {
  host: string
  port: number
  /** true = TLS from the first byte (465). false = plain, then upgrade with STARTTLS (587). */
  secure: boolean
  user: string
  pass: string
  timeoutMs?: number
}

export interface Mail {
  from: string
  fromName?: string
  to: string
  replyTo?: string
  subject: string
  text: string
}

interface Reply {
  code: number
  lines: string[]
}

/** Reads SMTP replies line by line, handling multi-line "250-..." responses. */
class ReplyReader {
  private buffer = ''
  private pending: string[] = []
  private waiters: { resolve: (r: Reply) => void; reject: (e: Error) => void }[] = []
  private replies: Reply[] = []
  private failure: Error | null = null

  attach(socket: net.Socket) {
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => this.push(chunk))
  }

  fail(err: Error) {
    this.failure = err
    for (const w of this.waiters.splice(0)) w.reject(err)
  }

  private push(chunk: string) {
    this.buffer += chunk
    let idx: number
    while ((idx = this.buffer.indexOf('\r\n')) !== -1) {
      const line = this.buffer.slice(0, idx)
      this.buffer = this.buffer.slice(idx + 2)
      this.pending.push(line)
      // "250 OK" ends a reply; "250-..." means more lines follow.
      if (/^\d{3}(?: |$)/.test(line)) {
        const reply = { code: Number(line.slice(0, 3)), lines: this.pending }
        this.pending = []
        const waiter = this.waiters.shift()
        if (waiter) waiter.resolve(reply)
        else this.replies.push(reply)
      }
    }
  }

  next(): Promise<Reply> {
    if (this.failure) return Promise.reject(this.failure)
    const ready = this.replies.shift()
    if (ready) return Promise.resolve(ready)
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }
}

export class SmtpError extends Error {
  readonly code: number | undefined
  constructor(message: string, code?: number) {
    super(message)
    this.name = 'SmtpError'
    this.code = code
  }
}

/** RFC 2047 encoding for header text that may contain non-ASCII characters. */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** Removes characters that could break out of a header line. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n')
}

export function buildMessage(mail: Mail): string {
  const domain = mail.from.split('@')[1] ?? 'localhost'
  const fromName = mail.fromName ? `"${encodeHeader(headerSafe(mail.fromName)).replace(/"/g, '')}" ` : ''
  const headers = [
    `From: ${fromName}<${headerSafe(mail.from)}>`,
    `To: <${headerSafe(mail.to)}>`,
    ...(mail.replyTo ? [`Reply-To: <${headerSafe(mail.replyTo)}>`] : []),
    `Subject: ${encodeHeader(headerSafe(mail.subject))}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ]
  const body = wrap76(Buffer.from(mail.text.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64'))
  // Base64 lines never start with ".", so no dot-stuffing is needed.
  return `${headers.join('\r\n')}\r\n\r\n${body}`
}

function connect(opts: SmtpOptions): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = opts.secure
      ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
      : net.connect({ host: opts.host, port: opts.port })
    socket.once(opts.secure ? 'secureConnect' : 'connect', () => resolve(socket))
    socket.once('error', reject)
  })
}

function upgrade(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    socket.removeAllListeners('data')
    const secured = tls.connect({ socket, servername: host })
    secured.once('secureConnect', () => resolve(secured))
    secured.once('error', reject)
  })
}

export async function sendMail(opts: SmtpOptions, mail: Mail): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 15_000
  let socket = await connect(opts)
  let reader = new ReplyReader()

  const watch = (s: net.Socket, r: ReplyReader) => {
    s.setTimeout(timeoutMs, () => {
      r.fail(new SmtpError('SMTP server timed out'))
      s.destroy()
    })
    s.on('error', (e) => r.fail(e))
    s.on('close', () => r.fail(new SmtpError('SMTP connection closed unexpectedly')))
    r.attach(s)
  }
  watch(socket, reader)

  const expect = async (codes: number[], step: string) => {
    const reply = await reader.next()
    if (!codes.includes(reply.code)) {
      throw new SmtpError(`${step} failed: ${reply.lines.join(' | ')}`, reply.code)
    }
    return reply
  }
  const send = async (line: string, codes: number[], step: string) => {
    socket.write(`${line}\r\n`)
    return expect(codes, step)
  }

  const ehloName = hostname() || 'localhost'

  try {
    await expect([220], 'Greeting')
    await send(`EHLO ${ehloName}`, [250], 'EHLO')

    if (!opts.secure) {
      await send('STARTTLS', [220], 'STARTTLS')
      socket.removeAllListeners('close')
      socket = await upgrade(socket, opts.host)
      reader = new ReplyReader()
      watch(socket, reader)
      await send(`EHLO ${ehloName}`, [250], 'EHLO after STARTTLS')
    }

    await send('AUTH LOGIN', [334], 'AUTH')
    await send(Buffer.from(opts.user).toString('base64'), [334], 'AUTH username')
    await send(Buffer.from(opts.pass).toString('base64'), [235], 'AUTH password')

    await send(`MAIL FROM:<${headerSafe(mail.from)}>`, [250], 'MAIL FROM')
    await send(`RCPT TO:<${headerSafe(mail.to)}>`, [250, 251], 'RCPT TO')
    await send('DATA', [354], 'DATA')
    await send(`${buildMessage(mail)}\r\n.`, [250], 'Message')

    socket.removeAllListeners('close')
    socket.write('QUIT\r\n')
    socket.end()
  } catch (err) {
    socket.removeAllListeners('close')
    socket.destroy()
    throw err
  }
}
