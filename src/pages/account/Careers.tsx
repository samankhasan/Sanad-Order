import { Briefcase, MessageCircle, Phone, Sparkles, TrendingUp, Users } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/ui'
import { CAREERS_PHONE, whatsappLink } from '../../lib/contact'

/** Help & info → Work with us: reach the company about jobs / partnership. */
export default function Careers() {
  const { t } = usePrefs()
  const { profile } = useAuth()
  const msg = `${t('careersWhatsappIntro')} ${profile?.full_name ?? ''}`.trim()
  return (
    <div>
      <PageHeader back="/account" title={t('workWithUs')} />
      <div className="page-narrow px-g space-y-4 pb-8">
        <section className="card overflow-hidden">
          <div className="bg-gradient-to-br from-[#0b3c7d] via-[#0284d6] to-[#4fa62f] p-6 text-white">
            <span className="grid size-14 place-items-center rounded-2xl bg-white/15 backdrop-blur"><Briefcase className="size-7" /></span>
            <h2 className="mt-4 text-xl font-black">{t('careersTitle')}</h2>
            <p className="mt-2 text-sm leading-7 text-white/85">{t('careersLead')}</p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {[[Users, t('careersSales')], [TrendingUp, t('careersDistributors')], [Sparkles, t('careersOther')]].map(([Icon, label], i) => {
              const I = Icon as typeof Users
              return <li key={i} className="flex items-center gap-3 px-5 py-3.5 text-sm font-bold"><I className="size-5 text-brand" />{label as string}</li>
            })}
          </ul>
        </section>
        <section className="card space-y-3 p-5">
          <p className="text-sm text-2">{t('careersContact')}</p>
          <p className="text-center text-xl font-black tabular-nums" dir="ltr">{CAREERS_PHONE.display}</p>
          <a href={whatsappLink(CAREERS_PHONE.e164, msg)} target="_blank" rel="noreferrer" className="btn min-h-14 w-full bg-[#25D366] text-base text-white"><MessageCircle className="size-5" />WhatsApp</a>
          <a href={`tel:+${CAREERS_PHONE.e164}`} className="btn btn-ghost min-h-12 w-full"><Phone className="size-5" />{t('call')}</a>
        </section>
      </div>
    </div>
  )
}
