import type { SmtpOptions } from './smtp.ts'

export interface Config {
  port: number
  smtp: SmtpOptions | null
  mailFrom: string
  mailTo: string
  missing: string[]
}

const REQUIRED = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO'] as const

export function loadConfig(env = process.env): Config {
  const missing = REQUIRED.filter((k) => !env[k]?.trim())
  const port = Number(env.PORT) || 3001
  const smtpPort = Number(env.SMTP_PORT) || 465
  const user = env.SMTP_USER?.trim() ?? ''

  return {
    port,
    missing,
    // Sender address. Gmail requires this to be the account you log in with,
    // so it defaults to SMTP_USER. MAIL_TO (the receiver) can be any inbox.
    mailFrom: env.MAIL_FROM?.trim() || user,
    mailTo: env.MAIL_TO?.trim() ?? '',
    smtp: missing.length
      ? null
      : {
          host: env.SMTP_HOST!.trim(),
          port: smtpPort,
          secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : smtpPort === 465,
          user,
          // Gmail shows App Passwords with spaces; SMTP needs them without.
          pass: env.SMTP_PASS!.replace(/\s+/g, ''),
        },
  }
}
