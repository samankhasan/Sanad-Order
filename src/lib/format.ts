import type { Lang } from './i18n'

const locales: Record<Lang, string> = { ku: 'ar-IQ', ar: 'ar-IQ', en: 'en-US' }

export function money(v: number, lang: Lang) {
  const n = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'en-US', { maximumFractionDigits: 0 }).format(Number(v) || 0)
  return lang === 'en' ? `${n}\u00A0IQD` : `${n}\u00A0د.ع`
}

export function dateTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(locales[lang], {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn'
  } as Intl.DateTimeFormatOptions).format(new Date(iso))
}

export function assetUrl(path: string | null | undefined) {
  if (!path) return ''
  if (/^https?:|^data:/.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function subName(s: { name_ku: string; name_ar: string | null; name_en: string | null }, lang: string) {
  return (lang === 'ar' ? s.name_ar : lang === 'en' ? s.name_en : s.name_ku) || s.name_ku
}

/** Small version of an uploaded picture (created at upload time as <name>_t.webp). */
export function thumbOf(url: string | null | undefined) {
  if (!url) return ''
  return url.includes('/product-images/') && url.endsWith('.webp') && !url.endsWith('_t.webp') ? url.replace(/\.webp$/, '_t.webp') : url
}
