/**
 * For local QR design: set VITE_TRACKING_API_URL in .env to your deployed API base, e.g.
 *   https://your-service.onrender.com
 * (no trailing slash). Register and QR links then use that host. Leave empty to use Vite
 * proxy to localhost:3000 (npm run dev:full / local API).
 */
export function getTrackingApiBase(): string {
  const raw = import.meta.env.VITE_TRACKING_API_URL as string | undefined
  if (!raw?.trim()) return ''
  return raw.trim().replace(/\/$/, '')
}

export function getDefaultPublicOrigin(): string {
  const base = getTrackingApiBase()
  if (base) return base
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:5173'
}

/** POST /api/tracks, GET /api/health, etc. */
export function getApiUrl(path: string): string {
  const base = getTrackingApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  if (base) return `${base}${p}`
  return p
}
