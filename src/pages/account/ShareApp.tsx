import { Copy, MessageCircle, Share2, Smartphone, Globe } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useToast } from '../../context/ToastContext'
import { ANDROID_APK_URL } from '../../lib/native'
import { assetUrl } from '../../lib/format'

export const APP_WEB_URL = 'https://samankhasan.github.io/Sanad-Order/'

/** Share Sanad Order with a friend — WhatsApp first, then the phone's share sheet or copying the link. */
export default function ShareApp({ onDone }: { onDone: () => void }) {
  const { t } = usePrefs()
  const toast = useToast()
  const text = `${t('shareMessage')}\n\n🌐 ${APP_WEB_URL}\n📱 Android: ${ANDROID_APK_URL}`

  const whatsapp = () => { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); onDone() }
  const native = async () => {
    try { await navigator.share({ title: 'Sanad Order', text }); onDone() } catch { /* cancelled */ }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast(t('linkCopied')) } catch { toast(APP_WEB_URL) }
  }

  return (
    <div className="space-y-4 p-5 text-center">
      <img src={assetUrl('icons/icon-192.png')} alt="" className="mx-auto size-20 rounded-[22px] shadow-lg" />
      <div>
        <h2 className="text-lg font-black">{t('shareApp')}</h2>
        <p className="mt-1 text-sm text-2">{t('shareAppHint')}</p>
      </div>
      <div className="rounded-2xl surface-2 p-3 text-start text-xs leading-6 text-2">
        <p>{t('shareMessage')}</p>
        <p className="mt-1 flex items-center gap-1.5" dir="ltr"><Globe className="size-3.5 shrink-0" /><span className="truncate">{APP_WEB_URL}</span></p>
        <p className="flex items-center gap-1.5" dir="ltr"><Smartphone className="size-3.5 shrink-0" /><span className="truncate">Android APK</span></p>
      </div>
      <button onClick={whatsapp} className="btn min-h-14 w-full bg-[#25D366] text-base text-white"><MessageCircle className="size-5" />WhatsApp</button>
      <div className="grid grid-cols-2 gap-2">
        {'share' in navigator && <button onClick={native} className="btn btn-ghost min-h-12"><Share2 className="size-5" />{t('shareOther')}</button>}
        <button onClick={copy} className="btn btn-ghost min-h-12" style={'share' in navigator ? undefined : { gridColumn: 'span 2' }}><Copy className="size-5" />{t('copyLink')}</button>
      </div>
    </div>
  )
}
