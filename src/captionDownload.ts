import type QRCodeStyling from 'qr-code-styling'

export type QrFrameOpts = {
  enabled: boolean
  widthPx: number
  paddingPx: number
  color: string
}

export type CaptionOpts = {
  top: string
  bottom: string
  fontSize: number
  color: string
  fontFamily: string
  padding: number
  gap: number
  qrSize: number
  background: string
  /** Square border + padding around the QR grid (not counting captions). */
  frame: QrFrameOpts
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (!text.trim()) return [' ']
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = words[0] || ''
  for (let i = 1; i < words.length; i++) {
    const w = words[i]
    const test = cur + ' ' + w
    if (ctx.measureText(test).width <= maxW) {
      cur = test
    } else {
      lines.push(cur)
      cur = w
    }
  }
  lines.push(cur)
  return lines
}

function splitToLines(
  ctx: CanvasRenderingContext2D,
  raw: string,
  maxW: number,
): string[] {
  const hard = raw.split('\n')
  const out: string[] = []
  for (const h of hard) {
    if (h === '') {
      out.push(' ')
    } else {
      out.push(...wrapLine(ctx, h, maxW))
    }
  }
  return out.length ? out : [' ']
}

export function hasCaptionText(top: string, bottom: string): boolean {
  return Boolean(top.trim() || bottom.trim())
}

function frameBlockOuter(qrSize: number, frame: QrFrameOpts | undefined): number {
  if (!frame?.enabled) return qrSize
  const W = Math.max(1, frame.widthPx)
  const P = Math.max(0, frame.paddingPx)
  const inner = qrSize + 2 * P
  return inner + 2 * W
}

/**
 * Renders QR (PNG) + top/bottom captions; downloads raster formats.
 */
export async function downloadCaptionedRaster(
  qr: QRCodeStyling,
  ext: 'png' | 'jpeg' | 'webp',
  fileName: string,
  opt: CaptionOpts,
): Promise<void> {
  const blob = await qr.getRawData('png')
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Could not render QR to PNG for export')
  }
  const bmp = await createImageBitmap(blob)

  const pad = opt.padding
  const gap = opt.gap
  const font = `${opt.fontSize}px ${opt.fontFamily}`

  const maxLineW = Math.max(320, Math.min(960, opt.qrSize * 1.2))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')

  ctx.font = font
  const topRaw = opt.top.trim()
  const bottomRaw = opt.bottom.trim()
  const topLines = topRaw ? splitToLines(ctx, topRaw, maxLineW) : []
  const bottomLines = bottomRaw ? splitToLines(ctx, bottomRaw, maxLineW) : []

  const lineH = Math.ceil(opt.fontSize * 1.3)
  const topH = topLines.length * lineH
  const bottomH = bottomLines.length * lineH
  const block = frameBlockOuter(opt.qrSize, opt.frame)

  let maxW = block
  for (const line of [...topLines, ...bottomLines]) {
    maxW = Math.max(maxW, Math.min(ctx.measureText(line).width, maxLineW))
  }
  const w = Math.ceil(maxW + pad * 2)
  const h = Math.ceil(
    pad + (topH ? topH + gap : 0) + block + (bottomH ? gap + bottomH : 0) + pad,
  )

  canvas.width = w
  canvas.height = h
  ctx.fillStyle = opt.background
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = opt.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = font

  let y = pad
  for (const line of topLines) {
    ctx.fillText(line, w / 2, y, maxLineW)
    y += lineH
  }
  if (topLines.length) y += gap

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (opt.frame?.enabled) {
    const f = opt.frame
    const W = Math.max(1, f.widthPx)
    const P = Math.max(0, f.paddingPx)
    const inner = opt.qrSize + 2 * P
    const x0 = (w - block) / 2
    ctx.fillStyle = f.color
    ctx.fillRect(x0, y, block, block)
    ctx.fillStyle = opt.background
    ctx.fillRect(x0 + W, y + W, inner, inner)
    ctx.drawImage(bmp, x0 + W + P, y + W + P, opt.qrSize, opt.qrSize)
  } else {
    const xQr = (w - opt.qrSize) / 2
    ctx.drawImage(bmp, xQr, y, opt.qrSize, opt.qrSize)
  }
  bmp.close()

  y += block
  if (bottomLines.length) y += gap
  for (const line of bottomLines) {
    ctx.fillText(line, w / 2, y, maxLineW)
    y += lineH
  }

  const type = ext === 'png' ? 'image/png' : ext === 'jpeg' ? 'image/jpeg' : 'image/webp'
  const quality = ext === 'png' ? undefined : 0.92
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), type, quality as number | undefined),
  )
  if (!out) throw new Error('Export failed')

  const a = document.createElement('a')
  a.href = URL.createObjectURL(out)
  a.download = `${fileName}.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * Single SVG with embedded PNG QR and text, so layout matches PNG export.
 */
export async function downloadCaptionedSvg(
  qr: QRCodeStyling,
  fileName: string,
  opt: CaptionOpts,
): Promise<void> {
  const blob = await qr.getRawData('png')
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Could not render QR to PNG for export')
  }
  const b64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result)
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(blob)
  })

  const pad = opt.padding
  const gap = opt.gap
  const maxLineW = Math.max(320, Math.min(960, opt.qrSize * 1.2))
  const font = `${opt.fontSize}px ${opt.fontFamily}`

  const c = document.createElement('canvas')
  c.width = 1
  c.height = 1
  const mctx = c.getContext('2d')
  if (!mctx) throw new Error('Canvas unsupported')
  mctx.font = font
  const topRaw = opt.top.trim()
  const bottomRaw = opt.bottom.trim()
  const topLines = topRaw ? splitToLines(mctx, topRaw, maxLineW) : []
  const bottomLines = bottomRaw ? splitToLines(mctx, bottomRaw, maxLineW) : []

  const lineH = Math.ceil(opt.fontSize * 1.3)
  const topH = topLines.length * lineH
  const bottomH = bottomLines.length * lineH
  const block = frameBlockOuter(opt.qrSize, opt.frame)
  let maxW = block
  for (const line of [...topLines, ...bottomLines]) {
    maxW = Math.max(maxW, Math.min(mctx.measureText(line).width, maxLineW))
  }
  const w = maxW + pad * 2
  const h = pad + (topH ? topH + gap : 0) + block + (bottomH ? gap + bottomH : 0) + pad

  const esc = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const fontEsc = esc(opt.fontFamily)
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}">`,
  )
  parts.push(`<rect width="100%" height="100%" fill="${esc(opt.background)}"/>`)

  let ty = pad
  for (const line of topLines) {
    parts.push(
      `<text x="${(w / 2).toFixed(1)}" y="${(ty + opt.fontSize * 0.85).toFixed(1)}" text-anchor="middle" font-family="${fontEsc}" font-size="${opt.fontSize}" fill="${esc(
        opt.color,
      )}">${esc(line)}</text>`,
    )
    ty += lineH
  }
  const yQr = pad + (topH ? topH + gap : 0)
  const xBlock = (w - block) / 2
  if (opt.frame?.enabled) {
    const f = opt.frame
    const W = Math.max(1, f.widthPx)
    const P = Math.max(0, f.paddingPx)
    const inner = opt.qrSize + 2 * P
    parts.push(
      `<rect x="${xBlock.toFixed(1)}" y="${yQr.toFixed(1)}" width="${block.toFixed(1)}" height="${block.toFixed(1)}" fill="${esc(f.color)}"/>`,
    )
    parts.push(
      `<rect x="${(xBlock + W).toFixed(1)}" y="${(yQr + W).toFixed(1)}" width="${inner.toFixed(1)}" height="${inner.toFixed(1)}" fill="${esc(opt.background)}"/>`,
    )
    parts.push(
      `<image href="data:image/png;base64,${b64}" x="${(xBlock + W + P).toFixed(1)}" y="${(yQr + W + P).toFixed(1)}" width="${opt.qrSize}" height="${opt.qrSize}" preserveAspectRatio="xMidYMid meet"/>`,
    )
  } else {
    const xQr = (w - opt.qrSize) / 2
    parts.push(
      `<image href="data:image/png;base64,${b64}" x="${xQr.toFixed(1)}" y="${yQr.toFixed(1)}" width="${opt.qrSize}" height="${opt.qrSize}" preserveAspectRatio="xMidYMid meet"/>`,
    )
  }
  let by = yQr + block
  if (bottomLines.length) by += gap
  for (const line of bottomLines) {
    parts.push(
      `<text x="${(w / 2).toFixed(1)}" y="${(by + opt.fontSize * 0.85).toFixed(1)}" text-anchor="middle" font-family="${fontEsc}" font-size="${opt.fontSize}" fill="${esc(
        opt.color,
      )}">${esc(line)}</text>`,
    )
    by += lineH
  }
  parts.push('</svg>')

  const out = new Blob([parts.join('')], { type: 'image/svg+xml;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(out)
  a.download = `${fileName}.svg`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function needsCompositeExport(cap: CaptionOpts): boolean {
  return hasCaptionText(cap.top, cap.bottom) || Boolean(cap.frame?.enabled)
}

export async function downloadWithOptionalCaptions(
  qr: QRCodeStyling,
  ext: 'png' | 'svg' | 'jpeg' | 'webp',
  fileName: string,
  cap: CaptionOpts,
  plainDownload: () => void,
): Promise<void> {
  if (!needsCompositeExport(cap)) {
    plainDownload()
    return
  }
  if (ext === 'svg') {
    await downloadCaptionedSvg(qr, fileName, cap)
  } else {
    await downloadCaptionedRaster(qr, ext, fileName, cap)
  }
}
