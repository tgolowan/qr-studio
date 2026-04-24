import nodemailer from 'nodemailer'

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SMTP_SECURE,
} = process.env

export function isMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS)
}

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  if (!isMailConfigured()) return null
  const port = Number(SMTP_PORT) || 587
  const secure = SMTP_SECURE === 'true' || port === 465
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
export async function sendMail(opts) {
  const t = getTransporter()
  if (!t) {
    console.warn(
      '[qr-studio] Email not sent (set SMTP_HOST, SMTP_USER, SMTP_PASS in .env).',
      { to: opts.to, subject: opts.subject },
    )
    return { ok: false, skipped: true }
  }
  const from = SMTP_FROM || `QR Studio <${SMTP_USER}>`
  await t.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html })
  return { ok: true }
}
