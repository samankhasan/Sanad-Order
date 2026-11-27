import { Globe, Mail, Paintbrush, ShieldCheck, Truck } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { PageHeader } from '../../components/ui'
import { assetUrl } from '../../lib/format'
import { COMPANY_EMAIL, COMPANY_WEBSITE } from '../../lib/contact'

/** Help & info → About us: who Sanad Company is, and a one-tap e-mail to the company. */
export default function AboutUs() {
  const { t } = usePrefs()
  const mail = `mailto:${COMPANY_EMAIL}?subject=${encodeURIComponent('Sanad Order')}`
  return (
    <div>
      <PageHeader back="/account" title={t('aboutUs')} />
      <div className="page-narrow px-g space-y-4 pb-8">
        <section className="card overflow-hidden text-center">
          <div className="bg-ink px-6 pb-8 pt-8 text-white">
            <img src={assetUrl('brands/sanad-mark.png')} alt="Sanad Company" className="mx-auto h-20 rounded-2xl bg-white p-2" />
            <h2 className="mt-4 text-xl font-black">{t('companyName')}</h2>
            <p className="mt-2 text-sm leading-7 text-white/75">{t('aboutUsLead')}</p>
          </div>
          <div className="h-1.5 sanad-stripe" />
          <div className="grid grid-cols-3 divide-x divide-[var(--border)] rtl:divide-x-reverse">
            {[[Paintbrush, t('aboutBrands')], [Truck, t('aboutDelivery')], [ShieldCheck, t('aboutOriginal')]].map(([Icon, label], i) => {
              const I = Icon as typeof Paintbrush
              return <div key={i} className="flex flex-col items-center gap-1.5 p-4"><I className="size-6 text-brand" /><span className="text-[11px] font-bold leading-tight">{label as string}</span></div>
            })}
          </div>
        </section>

        <section className="card p-5">
          <p className="text-sm leading-8 text-2">{t('aboutUsBody')}</p>
        </section>

        <a href={mail} className="card flex items-center gap-3 p-4 transition active:scale-[.99]">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-brand)] text-white shadow-md"><Mail className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{t('emailUs')}</p>
            <p className="truncate text-sm text-2" dir="ltr">{COMPANY_EMAIL}</p>
          </div>
        </a>
        <a href={COMPANY_WEBSITE} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4 transition active:scale-[.99]">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl surface-2"><Globe className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{t('website')}</p>
            <p className="truncate text-sm text-2" dir="ltr">www.sanadcompany.com</p>
          </div>
        </a>
      </div>
    </div>
  )
}
