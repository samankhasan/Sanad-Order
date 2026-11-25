import type { Lang } from './i18n'

const locales: Record<Lang, string> = { ku: 'ar-IQ', ar: 'ar-IQ', en: 'en-US' }

export function money(v: number, lang: Lang) {
  const n = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'en-US', { maximumFractionDigits: 0 }).format(Number(v) || 0)
  return lang === 'en' ? `${n} IQD` : `${n} د.ع`
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
