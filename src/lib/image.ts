// Image optimisation in the browser before upload.
// Any photo (even 10–20 MB from a phone camera) becomes a sharp WebP of a few dozen KB,
// plus a small thumbnail for lists, so the app opens fast on mobile data.
import { supabase, IMAGE_BUCKET } from './supabase'

export interface Preset { max: number; targetKB: number; thumb: number; thumbKB: number }
export const PRESETS = {
  product: { max: 1000, targetKB: 90, thumb: 360, thumbKB: 22 } as Preset,
  banner: { max: 1280, targetKB: 140, thumb: 360, thumbKB: 25 } as Preset
}

async function loadBitmap(src: Blob): Promise<ImageBitmap> {
  // respect EXIF rotation from phone cameras
  try { return await createImageBitmap(src, { imageOrientation: 'from-image' } as ImageBitmapOptions) } catch { return await createImageBitmap(src) }
}

function draw(bmp: ImageBitmap, max: number) {
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  return canvas
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('compress failed'))), 'image/webp', q))

/** Highest quality that fits the size target (never below 0.6), shrinking further if needed. */
async function encode(bmp: ImageBitmap, max: number, targetKB: number) {
  let size = max
  for (let pass = 0; pass < 4; pass++) {
    const c = draw(bmp, size)
    for (const q of [0.86, 0.8, 0.74, 0.68, 0.62]) {
      const b = await toBlob(c, q)
      if (b.size <= targetKB * 1024) return b
    }
    size = Math.round(size * 0.8)
  }
  return toBlob(draw(bmp, size), 0.6)
}

export async function compressImage(file: Blob, preset: Preset = PRESETS.product) {
  const bmp = await loadBitmap(file)
  const [full, thumb] = await Promise.all([encode(bmp, preset.max, preset.targetKB), encode(bmp, preset.thumb, preset.thumbKB)])
  bmp.close?.()
  return { full, thumb }
}

/** Upload a picture as `<folder>/<id>.webp` + `<id>_t.webp`; returns the public URL of the full image. */
export async function uploadOptimized(file: Blob, folder: string, preset: Preset = PRESETS.product) {
  const { full, thumb } = await compressImage(file, preset)
  const id = crypto.randomUUID()
  const path = `${folder}/${id}.webp`
  // brand-new random names: plain insert (no upsert), which only needs the INSERT policy
  const opts = { contentType: 'image/webp', cacheControl: '31536000', upsert: false }
  const [a, b] = await Promise.all([
    supabase.storage.from(IMAGE_BUCKET).upload(path, full, opts),
    supabase.storage.from(IMAGE_BUCKET).upload(`${folder}/${id}_t.webp`, thumb, opts)
  ])
  if (a.error) throw a.error
  if (b.error) console.warn('thumbnail upload', b.error)
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Re-optimise an image already in storage (same URL) and create its thumbnail. Returns bytes saved. */
export async function reoptimizeStored(url: string, preset: Preset = PRESETS.product) {
  const marker = `/object/public/${IMAGE_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0 || !url.endsWith('.webp') || url.endsWith('_t.webp')) return 0
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0])
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return 0
  const original = await res.blob()
  const { full, thumb } = await compressImage(original, preset)
  const opts = { contentType: 'image/webp', cacheControl: '31536000', upsert: true }
  await supabase.storage.from(IMAGE_BUCKET).upload(path.replace(/\.webp$/, '_t.webp'), thumb, opts)
  if (full.size < original.size * 0.9) {
    await supabase.storage.from(IMAGE_BUCKET).upload(path, full, opts)
    return original.size - full.size
  }
  return 0
}
