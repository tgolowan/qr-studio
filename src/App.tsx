import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCodeStyling from 'qr-code-styling'
import type {
  CornerDotType,
  CornerSquareType,
  DotType,
  DrawType,
  ErrorCorrectionLevel,
  Gradient,
  ShapeType,
} from 'qr-code-styling'
import { downloadWithOptionalCaptions, type CaptionOpts, hasCaptionText } from './captionDownload'
import './App.css'

const CAPTION_FONTS: { id: string; label: string; stack: string }[] = [
  { id: 'system', label: 'System UI', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Monospace', stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
]

const DOTS: DotType[] = [
  'square',
  'dots',
  'rounded',
  'extra-rounded',
  'classy',
  'classy-rounded',
]
const CORNERS: (CornerDotType | CornerSquareType)[] = [
  'square',
  'dot',
  'extra-rounded',
  'rounded',
  'dots',
  'classy',
  'classy-rounded',
]
const EC: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H']

type FgMode = 'solid' | 'gradient' | 'radial'
type BgMode = 'solid' | 'gradient' | 'radial'

function makeLinearGradient(c0: string, c1: string, rotation: number): Gradient {
  return {
    type: 'linear',
    rotation: (rotation * Math.PI) / 180,
    colorStops: [
      { offset: 0, color: c0 },
      { offset: 1, color: c1 },
    ],
  }
}

function makeRadialGradient(c0: string, c1: string): Gradient {
  return {
    type: 'radial',
    colorStops: [
      { offset: 0, color: c0 },
      { offset: 1, color: c1 },
    ],
  }
}

function App() {
  const [payloadMode, setPayloadMode] = useState<'url' | 'text' | 'email' | 'phone'>('url')
  const [rawValue, setRawValue] = useState('https://example.com')
  const [publicOrigin, setPublicOrigin] = useState(
    () => (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
  )
  const [targetUrl, setTargetUrl] = useState('https://example.com')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifyTelegramChatId, setNotifyTelegramChatId] = useState('')

  const [trackData, setTrackData] = useState('')
  const [trackId, setTrackId] = useState<string | null>(null)
  const [registerStatus, setRegisterStatus] = useState<string | null>(null)

  /** Off by default so `npm run dev` (Vite only) shows a real QR without registering a link. */
  const [useTracking, setUseTracking] = useState(false)

  const [drawType, setDrawType] = useState<DrawType>('svg')
  const [shape, setShape] = useState<ShapeType>('square')
  const [size, setSize] = useState(512)
  const [margin, setMargin] = useState(12)
  const [dotType, setDotType] = useState<DotType>('rounded')
  const [cornerSquare, setCornerSquare] = useState<CornerSquareType>('extra-rounded')
  const [cornerDot, setCornerDot] = useState<CornerDotType>('dot')
  const [errorLevel, setErrorLevel] = useState<ErrorCorrectionLevel>('Q')
  const [imageSize, setImageSize] = useState(0.35)
  const [hideBGDots, setHideBGDots] = useState(true)

  const [fgMode, setFgMode] = useState<FgMode>('solid')
  const [fg, setFg] = useState('#0f172a')
  const [fg2, setFg2] = useState('#3b82f6')
  const [fgRot, setFgRot] = useState(25)

  const [bgMode, setBgMode] = useState<BgMode>('solid')
  const [bg, setBg] = useState('#ffffff')
  const [bg2, setBg2] = useState('#e0e7ff')
  const [bgRot, setBgRot] = useState(0)

  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>()

  const [captionTop, setCaptionTop] = useState('')
  const [captionBottom, setCaptionBottom] = useState('')
  const [captionFontSize, setCaptionFontSize] = useState(20)
  const [captionColor, setCaptionColor] = useState('#0f172a')
  const [captionFontId, setCaptionFontId] = useState('system')

  const hostRef = useRef<HTMLDivElement>(null)
  const qrRef = useRef<QRCodeStyling | null>(null)

  const encodedData = useMemo(() => {
    if (useTracking && trackData) return trackData
    if (useTracking) return ''
    if (payloadMode === 'email') {
      return rawValue.trim().toLowerCase().startsWith('mailto:')
        ? rawValue
        : `mailto:${rawValue.replace(/^mailto:/i, '')}`
    }
    if (payloadMode === 'phone') {
      const p = rawValue.replace(/\s+/g, '')
      return p.startsWith('tel:') ? p : `tel:${p}`
    }
    return rawValue
  }, [useTracking, trackData, payloadMode, rawValue])

  const dotsOptions = useMemo(() => {
    if (fgMode === 'solid') {
      return { type: dotType, color: fg }
    }
    if (fgMode === 'gradient') {
      return { type: dotType, gradient: makeLinearGradient(fg, fg2, fgRot) }
    }
    return { type: dotType, gradient: makeRadialGradient(fg, fg2) }
  }, [fgMode, dotType, fg, fg2, fgRot])

  const backgroundOptions = useMemo(() => {
    if (bgMode === 'solid') {
      return { color: bg, round: 0 }
    }
    if (bgMode === 'gradient') {
      return { color: 'transparent', gradient: makeLinearGradient(bg, bg2, bgRot) }
    }
    return { color: 'transparent', gradient: makeRadialGradient(bg, bg2) }
  }, [bgMode, bg, bg2, bgRot])

  const cornersSquareOptions = useMemo(() => {
    return {
      type: cornerSquare,
      color: fgMode === 'solid' ? fg : undefined,
      gradient: fgMode !== 'solid' ? (dotsOptions as { gradient?: Gradient }).gradient : undefined,
    }
  }, [cornerSquare, fg, fgMode, dotsOptions])

  const cornersDotOptions = useMemo(
    () => ({
      type: cornerDot,
      color: fgMode === 'solid' ? fg : undefined,
      gradient: fgMode !== 'solid' ? (dotsOptions as { gradient?: Gradient }).gradient : undefined,
    }),
    [cornerDot, fg, fgMode, dotsOptions],
  )

  const buildOptions = useCallback(() => {
    return {
      width: size,
      height: size,
      type: drawType,
      shape,
      margin,
      data: encodedData || ' ',
      image: logoDataUrl,
      dotsOptions,
      backgroundOptions: backgroundOptions as (typeof backgroundOptions) & { color: string; round: number },
      cornersSquareOptions,
      cornersDotOptions,
      imageOptions: {
        hideBackgroundDots: hideBGDots,
        imageSize: Math.min(0.55, Math.max(0.08, imageSize)),
        margin: 4,
        crossOrigin: 'anonymous' as const,
      },
      qrOptions: { errorCorrectionLevel: errorLevel },
    }
  }, [
    size,
    drawType,
    shape,
    margin,
    encodedData,
    logoDataUrl,
    dotsOptions,
    backgroundOptions,
    cornersSquareOptions,
    cornersDotOptions,
    hideBGDots,
    imageSize,
    errorLevel,
  ])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const o = buildOptions()
    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(o)
      qrRef.current.append(host)
    } else {
      qrRef.current.update(o)
    }
  }, [buildOptions])

  const captionFontStack = useMemo(
    () => CAPTION_FONTS.find((f) => f.id === captionFontId)?.stack ?? CAPTION_FONTS[0].stack,
    [captionFontId],
  )

  const exportCaptionBackground = useMemo(
    () => (bgMode === 'solid' ? bg : '#ffffff'),
    [bgMode, bg],
  )

  const download = async (ext: 'png' | 'svg' | 'jpeg' | 'webp') => {
    const qr = qrRef.current
    if (!qr || !encodedData.trim()) return
    const name = useTracking && trackId ? `qr-${trackId}` : 'qr-code'
    const cap: CaptionOpts = {
      top: captionTop,
      bottom: captionBottom,
      fontSize: captionFontSize,
      color: captionColor,
      fontFamily: captionFontStack,
      padding: 20,
      gap: 12,
      qrSize: size,
      background: exportCaptionBackground,
    }
    const plain = () => {
      void qr.download({ name, extension: ext })
    }
    try {
      await downloadWithOptionalCaptions(qr, ext, name, cap, plain)
    } catch (e) {
      console.error(e)
    }
  }

  const registerTrack = async () => {
    setRegisterStatus(null)
    const base = publicOrigin.replace(/\/$/, '')
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      setRegisterStatus('Public origin must start with http:// or https://')
      return
    }
    if (!notifyEmail.trim() && !notifyTelegramChatId.trim()) {
      setRegisterStatus('Add an email and/or a Telegram chat id for scan notifications.')
      return
    }
    const r = await fetch('/api/tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl,
        notifyEmail: notifyEmail.trim(),
        notifyTelegramChatId: notifyTelegramChatId.trim(),
      }),
    })
    if (!r.ok) {
      const e = (await r.json().catch(() => ({}))) as { error?: string }
      setRegisterStatus(e.error || 'Request failed')
      return
    }
    const j = (await r.json()) as { id: string; mail: boolean; telegram: boolean }
    setTrackId(j.id)
    setTrackData(`${base}/t/${j.id}`)
    const wantsMail = Boolean(notifyEmail.trim())
    const wantsTg = Boolean(notifyTelegramChatId.trim())
    const lines: string[] = ['Link registered. Notifications throttled (about once per minute per link by default).']
    if (wantsMail) {
      lines.push(
        j.mail
          ? 'Email: server is configured; you will get emails on scan.'
          : 'Email: set SMTP in server .env to receive email (see .env.example).',
      )
    }
    if (wantsTg) {
      lines.push(
        j.telegram
          ? 'Telegram: bot token set; you will get Telegram messages on scan (after you started the bot, see .env).'
          : 'Telegram: add TELEGRAM_BOT_TOKEN to server .env and open your bot in Telegram first.',
      )
    }
    setRegisterStatus(lines.join(' '))
  }

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) {
      setLogoDataUrl(undefined)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoDataUrl(String(reader.result))
    reader.readAsDataURL(f)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>QR Studio</h1>
        <p>Design codes with graphics and colors. Tracked links can notify you by email and/or Telegram when opened.</p>
      </header>

      <div className="app-grid">
        <section className="card preview" aria-label="Preview">
          <div
            className="preview-frame"
            style={{ background: hasCaptionText(captionTop, captionBottom) ? exportCaptionBackground : undefined }}
          >
            <div className="qr-figure">
              {hasCaptionText(captionTop, captionBottom) && captionTop.trim() && (
                <div
                  className="qr-caption"
                  style={{
                    color: captionColor,
                    fontSize: captionFontSize,
                    fontFamily: captionFontStack,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {captionTop}
                </div>
              )}
              <div className="qr-host" ref={hostRef} />
              {hasCaptionText(captionTop, captionBottom) && captionBottom.trim() && (
                <div
                  className="qr-caption"
                  style={{
                    color: captionColor,
                    fontSize: captionFontSize,
                    fontFamily: captionFontStack,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {captionBottom}
                </div>
              )}
            </div>
            {!encodedData.trim() && <p className="hint">Register a tracked link or enter content to preview.</p>}
          </div>
          <div className="row wrap">
            <button type="button" className="primary" onClick={() => void download('png')} disabled={!encodedData.trim()}>
              PNG
            </button>
            <button type="button" onClick={() => void download('svg')} disabled={!encodedData.trim()}>
              SVG
            </button>
            <button type="button" onClick={() => void download('jpeg')} disabled={!encodedData.trim()}>
              JPEG
            </button>
            <button type="button" onClick={() => void download('webp')} disabled={!encodedData.trim()}>
              WebP
            </button>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <h2>Content &amp; scan email</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={useTracking}
                onChange={() => {
                  setUseTracking((u) => {
                    const next = !u
                    if (!next) {
                      setTrackData('')
                      setTrackId(null)
                      setRegisterStatus(null)
                    }
                    return next
                  })
                }}
              />
              <span>Tracked link (notify me by email and/or Telegram when the QR is opened)</span>
            </label>
            {useTracking ? (
              <div className="fields">
                <label>
                  <span>Destination URL (https)</span>
                  <input
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://…"
                    autoComplete="url"
                  />
                </label>
                <label>
                  <span>Your email (optional if Telegram is set)</span>
                  <input
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>
                <label>
                  <span>Telegram chat id (optional if email is set)</span>
                  <input
                    value={notifyTelegramChatId}
                    onChange={(e) => setNotifyTelegramChatId(e.target.value.replace(/\s/g, ''))}
                    inputMode="numeric"
                    placeholder="e.g. 123456789"
                    autoComplete="off"
                  />
                </label>
                <p className="small">
                  <strong>Telegram setup:</strong> create a bot in <a href="https://t.me/BotFather">@BotFather</a>, add{' '}
                  <code>TELEGRAM_BOT_TOKEN</code> to the <strong>server</strong> environment (e.g. Render →
                  Environment). Open a <strong>private chat with your bot</strong> and tap <strong>Start</strong> (the
                  bot only send you messages after that). Paste your numeric id from{' '}
                  <a href="https://t.me/userinfobot">@userinfobot</a> here. After you register,{' '}
                  <strong>notifications appear when someone opens the tracking link</strong> from the QR—not from
                  opening the bot by itself. Verify <code>/api/health</code> shows <code>&quot;telegram&quot;: true</code>{' '}
                  on your deployed site.
                </p>
                <label>
                  <span>Public origin of this app (what the QR will encode)</span>
                  <input
                    value={publicOrigin}
                    onChange={(e) => setPublicOrigin(e.target.value)}
                    placeholder="http://192.168.1.10:5173"
                  />
                </label>
                <p className="small">
                  For a phone to hit your machine, use your LAN address and the same port as Vite, or deploy and use your
                  public URL. The code encodes <code>origin + /t/id</code>.
                </p>
                <button type="button" className="primary" onClick={registerTrack}>
                  Register &amp; set QR to tracking link
                </button>
                {registerStatus && <p className="status">{registerStatus}</p>}
                {trackId && (
                  <p className="small">
                    <strong>Current payload:</strong> <code className="break">{trackData || '(none)'}</code>
                  </p>
                )}
              </div>
            ) : (
              <div className="fields">
                <div className="row">
                  <label>
                    <span>Payload type</span>
                    <select
                      value={payloadMode}
                      onChange={(e) => {
                        setPayloadMode(e.target.value as typeof payloadMode)
                        if (e.target.value === 'url') {
                          setRawValue('https://example.com')
                        } else if (e.target.value === 'email') {
                          setRawValue('hello@example.com')
                        } else if (e.target.value === 'phone') {
                          setRawValue('+12025550123')
                        } else {
                          setRawValue('Plain text or Wi‑Fi string')
                        }
                      }}
                    >
                      <option value="url">URL / text</option>
                      <option value="text">Plain text</option>
                      <option value="email">Email (mailto)</option>
                      <option value="phone">Phone (tel)</option>
                    </select>
                  </label>
                </div>
                <label>
                  <span>Value</span>
                  <textarea
                    rows={3}
                    value={rawValue}
                    onChange={(e) => setRawValue(e.target.value)}
                    placeholder="https://… or text"
                  />
                </label>
                <p className="small">Preview updates as you type. For scan notifications, use tracked mode and SMTP.</p>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Layout &amp; modules</h2>
            <div className="field-grid">
              <label>
                <span>Render</span>
                <select value={drawType} onChange={(e) => setDrawType(e.target.value as DrawType)}>
                  <option value="svg">SVG (sharp)</option>
                  <option value="canvas">Canvas</option>
                </select>
              </label>
              <label>
                <span>Body shape</span>
                <select value={shape} onChange={(e) => setShape(e.target.value as ShapeType)}>
                  <option value="square">Square</option>
                  <option value="circle">Circle</option>
                </select>
              </label>
              <label>
                <span>Size (px)</span>
                <input
                  type="number"
                  min={128}
                  max={2048}
                  step={32}
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value) || 512)}
                />
              </label>
              <label>
                <span>Quiet margin</span>
                <input
                  type="number"
                  min={0}
                  max={64}
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value) || 0)}
                />
              </label>
              <label>
                <span>Dot style</span>
                <select value={dotType} onChange={(e) => setDotType(e.target.value as DotType)}>
                  {DOTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Finder frame</span>
                <select value={cornerSquare} onChange={(e) => setCornerSquare(e.target.value as CornerSquareType)}>
                  {CORNERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Finder center</span>
                <select value={cornerDot} onChange={(e) => setCornerDot(e.target.value as CornerDotType)}>
                  {CORNERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Error correction</span>
                <select value={errorLevel} onChange={(e) => setErrorLevel(e.target.value as ErrorCorrectionLevel)}>
                  {EC.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="card">
            <h2>Colors</h2>
            <div className="field-grid">
              <label>
                <span>Modules (foreground) mode</span>
                <select value={fgMode} onChange={(e) => setFgMode(e.target.value as FgMode)}>
                  <option value="solid">Solid</option>
                  <option value="gradient">Linear gradient</option>
                  <option value="radial">Radial gradient</option>
                </select>
              </label>
              <label>
                <span>Color A</span>
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
              </label>
              {fgMode !== 'solid' && (
                <>
                  <label>
                    <span>Color B</span>
                    <input type="color" value={fg2} onChange={(e) => setFg2(e.target.value)} />
                  </label>
                  {fgMode === 'gradient' && (
                    <label>
                      <span>Angle (°)</span>
                      <input type="number" value={fgRot} onChange={(e) => setFgRot(Number(e.target.value) || 0)} />
                    </label>
                  )}
                </>
              )}
            </div>
            <div className="field-grid" style={{ marginTop: 12 }}>
              <label>
                <span>Background mode</span>
                <select value={bgMode} onChange={(e) => setBgMode(e.target.value as BgMode)}>
                  <option value="solid">Solid</option>
                  <option value="gradient">Linear gradient</option>
                  <option value="radial">Radial gradient</option>
                </select>
              </label>
              <label>
                <span>Color A</span>
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
              </label>
              {bgMode !== 'solid' && (
                <>
                  <label>
                    <span>Color B</span>
                    <input type="color" value={bg2} onChange={(e) => setBg2(e.target.value)} />
                  </label>
                  {bgMode === 'gradient' && (
                    <label>
                      <span>Angle (°)</span>
                      <input type="number" value={bgRot} onChange={(e) => setBgRot(Number(e.target.value) || 0)} />
                    </label>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="card">
            <h2>Text on image</h2>
            <p className="small" style={{ marginTop: 0, marginBottom: 10 }}>
              Shown in the preview and included in all downloads. Line breaks and word-wrapping apply to exports. Leave
              both empty to export the QR only.
            </p>
            <div className="fields">
              <label>
                <span>Text above</span>
                <textarea
                  rows={2}
                  value={captionTop}
                  onChange={(e) => setCaptionTop(e.target.value)}
                  placeholder="e.g. Scan to open our menu"
                />
              </label>
              <label>
                <span>Text below</span>
                <textarea
                  rows={2}
                  value={captionBottom}
                  onChange={(e) => setCaptionBottom(e.target.value)}
                  placeholder="e.g. mysite.com"
                />
              </label>
              <div className="field-grid">
                <label>
                  <span>Font</span>
                  <select value={captionFontId} onChange={(e) => setCaptionFontId(e.target.value)}>
                    {CAPTION_FONTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Size (px)</span>
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={captionFontSize}
                    onChange={(e) => setCaptionFontSize(Number(e.target.value) || 20)}
                  />
                </label>
                <label>
                  <span>Text color</span>
                  <input type="color" value={captionColor} onChange={(e) => setCaptionColor(e.target.value)} />
                </label>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Center image</h2>
            <label>
              <span>Logo (optional, uses error correction)</span>
              <input type="file" accept="image/*" onChange={onLogo} />
            </label>
            {logoDataUrl && (
              <div className="row">
                <img src={logoDataUrl} alt="Logo" className="logo-thumb" />
                <button type="button" onClick={() => setLogoDataUrl(undefined)}>
                  Remove
                </button>
              </div>
            )}
            <label className="check">
              <input type="checkbox" checked={hideBGDots} onChange={() => setHideBGDots((h) => !h)} />
              <span>Clear modules behind the image</span>
            </label>
            <label>
              <span>Image size (relative to body)</span>
              <input
                type="range"
                min={0.1}
                max={0.5}
                step={0.01}
                value={imageSize}
                onChange={(e) => setImageSize(Number(e.target.value))}
              />
              <span className="small">{imageSize.toFixed(2)}</span>
            </label>
            <p className="small">With a logo, prefer error correction <strong>Q</strong> or <strong>H</strong>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default App
