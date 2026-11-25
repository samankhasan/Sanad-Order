import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dictionaries, LANGS, type Lang, type TKey } from '../lib/i18n'
import type { Category } from '../lib/types'
import { setThemeForStatusBar } from '../lib/native'

type Theme = 'light' | 'dark' | 'system'

interface Prefs {
  lang: Lang
  setLang: (l: Lang) => void
  theme: Theme
  setTheme: (t: Theme) => void
  t: (k: TKey) => string
  dir: 'rtl' | 'ltr'
  catName: (c: Pick<Category, 'name_en' | 'name_ku' | 'name_ar'>) => string
}

const Ctx = createContext<Prefs | null>(null)

function read<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback } catch { return fallback }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* ignore */ }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => read<Lang>('so.lang', 'ku'))
  const [theme, setThemeState] = useState<Theme>(() => read<Theme>('so.theme', 'system'))
  const dir = LANGS.find(l => l.code === lang)?.dir ?? 'rtl'

  useEffect(() => {
    document.documentElement.lang = lang === 'ku' ? 'ckb' : lang
    document.documentElement.dir = dir
  }, [lang, dir])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#070B14' : '#F5F6FA')
      setThemeForStatusBar(dark)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const value = useMemo<Prefs>(() => {
    const d = dictionaries[lang]
    return {
      lang, theme, dir,
      setLang: l => { write('so.lang', l); setLangState(l) },
      setTheme: t => { write('so.theme', t); setThemeState(t) },
      t: k => d[k] ?? dictionaries.en[k] ?? k,
      catName: c => (lang === 'ku' ? c.name_ku : lang === 'ar' ? c.name_ar : c.name_en)
    }
  }, [lang, theme, dir])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrefs() {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePrefs outside provider')
  return c
}
