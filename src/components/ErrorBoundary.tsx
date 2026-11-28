import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reloadForStaleChunk, reportError } from '../lib/errors'

const TEXT = {
  ku: { title: 'ببورە، هەڵەیەک ڕوویدا', body: 'کێشەکە بە شێوەیەکی خۆکار بۆ تیمەکەمان نێردرا. تکایە دووبارە هەوڵ بدەرەوە.', retry: 'دووبارە هەوڵدانەوە', home: 'گەڕانەوە بۆ سەرەکی' },
  ar: { title: 'عذراً، حدث خطأ', body: 'تم إرسال المشكلة تلقائياً إلى فريقنا. يرجى المحاولة مرة أخرى.', retry: 'إعادة المحاولة', home: 'العودة إلى الرئيسية' },
  en: { title: 'Sorry, something went wrong', body: 'The problem was sent to our team automatically. Please try again.', retry: 'Try again', home: 'Back to home' }
}

/** Last line of defence: a crash in any screen shows a friendly page (and is reported) instead of a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (reloadForStaleChunk(error.message)) return
    reportError(error, info.componentStack?.slice(0, 1500))
  }
  render() {
    if (!this.state.failed) return this.props.children
    let lang: keyof typeof TEXT = 'ku'
    try { const l = localStorage.getItem('so.lang'); if (l === 'ar' || l === 'en') lang = l } catch { /* ignore */ }
    const t = TEXT[lang]
    return (
      <div dir={lang === 'en' ? 'ltr' : 'rtl'} className="grid min-h-dvh place-items-center bg-[var(--bg)] p-6 text-center">
        <div className="w-full max-w-sm space-y-4 rounded-[28px] surface p-7 shadow-xl">
          <img src={`${import.meta.env.BASE_URL}brands/sanad-mark.png`} alt="Sanad" className="mx-auto h-14" />
          <h1 className="text-xl font-black">{t.title}</h1>
          <p className="text-sm leading-7 text-2">{t.body}</p>
          <button onClick={() => location.reload()} className="btn btn-primary min-h-13 w-full">{t.retry}</button>
          <button onClick={() => { location.hash = '#/'; location.reload() }} className="btn btn-ghost min-h-12 w-full">{t.home}</button>
        </div>
      </div>
    )
  }
}
