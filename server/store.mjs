import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
const storePath = join(dataDir, 'tracks.json')

/**
 * @typedef {object} TrackRow
 * @property {string} targetUrl
 * @property {string} [notifyEmail]
 * @property {string} [notifyTelegramChatId]
 * @property {string} createdAt
 * @property {number} [lastNotifiedAt]
 */
/** @type {Map<string, TrackRow> | null} */
let cache = null

async function ensureDir() {
  await mkdir(dataDir, { recursive: true })
}

export async function load() {
  if (cache) return cache
  await ensureDir()
  try {
    const raw = await readFile(storePath, 'utf8')
    const obj = JSON.parse(raw)
    cache = new Map(Object.entries(obj))
  } catch {
    cache = new Map()
  }
  return cache
}

export async function save() {
  if (!cache) return
  const obj = Object.fromEntries(cache)
  await writeFile(storePath, JSON.stringify(obj, null, 2), 'utf8')
}

/**
 * @param {string} id
 * @param {{ targetUrl: string, notifyEmail?: string, notifyTelegramChatId?: string }} data
 */
export async function setTrack(id, data) {
  const m = await load()
  const row = {
    targetUrl: data.targetUrl,
    notifyEmail: data.notifyEmail ?? '',
    notifyTelegramChatId: data.notifyTelegramChatId ?? '',
    createdAt: new Date().toISOString(),
  }
  m.set(id, row)
  await save()
  return row
}

/** @param {string} id */
export async function getTrack(id) {
  const m = await load()
  return m.get(id) ?? null
}

/**
 * @param {string} id
 * @param {number} at
 */
export async function setLastNotified(id, at) {
  const m = await load()
  const cur = m.get(id)
  if (!cur) return
  cur.lastNotifiedAt = at
  m.set(id, cur)
  await save()
}
