import process from 'node:process'

const { TELEGRAM_BOT_TOKEN } = process.env

export function isTelegramConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN.length > 10)
}

/**
 * Telegram accepts integer or string; integer avoids some client bugs.
 * @param {string} s
 * @returns {string | number}
 */
function toTelegramChatId(s) {
  const t = String(s).trim()
  if (!/^-?\d+$/.test(t)) {
    return t
  }
  const n = Number(t)
  return Number.isSafeInteger(n) ? n : t
}

/**
 * @param {{ chatId: string, text: string }} p
 * @returns {Promise<{ ok: boolean, skipped?: boolean }>}
 */
export async function sendTelegramMessage(p) {
  if (!isTelegramConfigured()) {
    console.warn('[qr-studio] Telegram not sent: set TELEGRAM_BOT_TOKEN in .env', { chatId: p.chatId })
    return { ok: false, skipped: true }
  }
  const chatId = toTelegramChatId(p.chatId)
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: p.text,
      disable_web_page_preview: true,
    }),
  })
  const raw = await r.text()
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    body = { ok: false, raw: raw.slice(0, 300) }
  }
  if (!r.ok || body.ok === false) {
    const desc = body.description || body.raw || raw
    throw new Error(`Telegram API ${r.status}: ${typeof desc === 'string' ? desc : JSON.stringify(body)}`)
  }
  console.log('[qr-studio] Telegram notify ok', { message_id: body.result?.message_id })
  return { ok: true }
}
