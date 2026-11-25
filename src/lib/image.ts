// Resize + compress an image in the browser before upload (keeps storage & mobile data small)
export async function compressImage(file: File, max = 1000, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('compress failed'))), 'image/webp', quality))
}
