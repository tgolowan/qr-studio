import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import { nanoid } from 'nanoid'
import { getTrack, setLastNotified, setTrack } from './store.mjs'
import { isMailConfigured, sendMail } from './mail.mjs'
import { isTelegramConfigured, sendTelegramMessage } from './telegram.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, '..', 'dist')
const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(
  cors({
    origin: true,
  }),
)
app.use(express.json({ limit: '1mb' }))

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_EMAIL_GAP_MS = Number(process.env.SCAN_EMAIL_THROTTLE_MS) || 60_000

function isValidHttpUrl(s) {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mail: isMailConfigured(), telegram: isTelegramConfigured() })
})

const chatIdRe = /^-?\d{4,20}$/

app.post('/api/tracks', async (req, res) => {
  const { targetUrl, notifyEmail, notifyTelegramChatId } = req.body || {}
  if (typeof targetUrl !== 'string' || !isValidHttpUrl(targetUrl)) {
    return res.status(400).json({ error: 'targetUrl must be a valid http(s) URL' })
  }
  const email = typeof notifyEmail === 'string' ? notifyEmail.trim() : ''
  const chat = typeof notifyTelegramChatId === 'string' ? notifyTelegramChatId.trim() : ''
  if (email && !emailRe.test(email)) {
    return res.status(400).json({ error: 'notifyEmail must be a valid address' })
  }
  if (chat && !chatIdRe.test(chat)) {
    return res
      .status(400)
      .json({ error: 'notifyTelegramChatId must be numeric (your Telegram user or group id)' })
  }
  if (!email && !chat) {
    return res.status(400).json({ error: 'Set notifyEmail and/or notifyTelegramChatId' })
  }
  const id = nanoid(12)
  await setTrack(id, { targetUrl, notifyEmail: email, notifyTelegramChatId: chat })
  res.json({ id, mail: isMailConfigured(), telegram: isTelegramConfigured() })
})

app.get('/t/:id', async (req, res) => {
  const { id } = req.params
  const row = await getTrack(id)
  if (!row) {
    return res.status(404).send(`<!DOCTYPE html><html><body><p>Unknown link.</p></body></html>`)
  }
  const now = Date.now()
  const last = row.lastNotifiedAt || 0
  const canNotify = now - last >= MIN_EMAIL_GAP_MS
  if (canNotify) {
    const ua = String(req.get('user-agent') || 'unknown')
    const ip =
      (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
      req.socket.remoteAddress ||
      ''
    const bodyText = `Your tracked QR was opened.

Destination: ${row.targetUrl}
Time (server): ${new Date().toISOString()}
IP: ${ip}
User-Agent: ${ua}
`
    const subject = 'QR code opened'
    const html = `<p>Your tracked QR was opened.</p>
<ul>
<li><strong>Destination:</strong> ${escapeHtml(row.targetUrl)}</li>
<li><strong>Time:</strong> ${escapeHtml(new Date().toISOString())}</li>
<li><strong>IP:</strong> ${escapeHtml(ip)}</li>
</ul>
<p><a href="${escapeAttr(row.targetUrl)}">Continue to destination</a></p>`

    let throttled = false
    if (row.notifyEmail?.trim()) {
      try {
        const result = await sendMail({ to: row.notifyEmail, subject, text: bodyText, html })
        if (result.ok || result.skipped) throttled = true
      } catch (e) {
        console.error('[qr-studio] email send failed', e)
      }
    }
    if (row.notifyTelegramChatId?.trim()) {
      try {
        const tResult = await sendTelegramMessage({ chatId: row.notifyTelegramChatId, text: bodyText.trim() })
        if (tResult.ok || tResult.skipped) throttled = true
      } catch (e) {
        console.error('[qr-studio] telegram send failed', e)
      }
    }
    if (throttled) {
      await setLastNotified(id, now)
    }
  }
  res.redirect(302, row.targetUrl)
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(dist))
  // Express 5 / path-to-regexp v8: bare "*" is invalid; use middleware instead of app.get("*", …)
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next()
    }
    if (req.path.startsWith('/api') || req.path.startsWith('/t/')) {
      return next()
    }
    res.sendFile(path.join(dist, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
}

app.listen(PORT, () => {
  console.log(`[qr-studio] API & redirects http://127.0.0.1:${PORT}`)
  console.log(
    isMailConfigured()
      ? 'SMTP: configured'
      : 'SMTP: not set — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env for email notifications',
  )
  console.log(
    isTelegramConfigured()
      ? 'Telegram: bot token set'
      : 'Telegram: not set — add TELEGRAM_BOT_TOKEN to .env for Telegram notifications',
  )
})

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}
