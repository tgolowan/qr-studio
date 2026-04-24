import process from 'node:process'

const { TELEGRAM_BOT_TOKEN } = process.env

export function isTelegramConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN.length > 10)
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
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: p.chatId,
      text: p.text,
      disable_web_page_preview: true,
    }),
  })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(`Telegram API ${r.status}: ${err.slice(0, 500)}`)
  }
  return { ok: true }
}
