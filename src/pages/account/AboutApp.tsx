import { Link } from 'react-router-dom'
import { FileText, Globe, Lock } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { PageHeader } from '../../components/ui'
import { assetUrl } from '../../lib/format'
import { COMPANY_WEBSITE } from '../../lib/contact'

/** Account → About the app: name, version, website and the legal pages. */
export default function AboutApp() {
  const { t } = usePrefs()
  return (
    <div>
      <PageHeader back="/account" title={t('about')} />
      <div className="page-narrow px-g space-y-4 pb-6">
        <section className="card flex flex-col items-center gap-2 p-8 text-center">
          <img src={assetUrl('icons/icon-192.png')} alt="" className="size-20 rounded-[22px] shadow" />
          <p className="mt-1 text-xl font-black">Sanad Order</p>
          <p className="text-sm text-2">{t('version')} <bdi dir="ltr">{__APP_VERSION__}</bdi></p>
          <div className="mt-2 h-1.5 w-16 rounded-full sanad-stripe" />
          <p className="mt-2 text-[11px] text-2" dir="ltr">Sanad Company © 2026</p>
        </section>
        <section className="card divide-y divide-[var(--border)] overflow-hidden">
          <a href={COMPANY_WEBSITE} target="_blank" rel="noreferrer" className="flex min-h-[60px] items-center gap-3 px-4 active:bg-[var(--surface-2)]">
            <Globe className="size-5 text-2" /><span className="flex-1 text-sm font-bold">{t('website')}</span><span className="text-sm font-semibold text-brand" dir="ltr">sanadcompany.com</span>
          </a>
          <Link to="/account/terms" className="flex min-h-[60px] items-center gap-3 px-4 active:bg-[var(--surface-2)]"><FileText className="size-5 text-2" /><span className="flex-1 text-sm font-bold">{t('termsTitle')}</span></Link>
          <Link to="/account/privacy" className="flex min-h-[60px] items-center gap-3 px-4 active:bg-[var(--surface-2)]"><Lock className="size-5 text-2" /><span className="flex-1 text-sm font-bold">{t('privacyTitle')}</span></Link>
        </section>
      </div>
    </div>
  )
}
