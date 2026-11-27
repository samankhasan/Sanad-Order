import { ExternalLink, Mail } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { PageHeader } from '../../components/ui'
import legal from '../../content/legal.json'

type Lang = 'ku' | 'ar' | 'en'

/** Terms & Conditions / Privacy Policy, in the app's language (same text as the public pages). */
export default function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const { t, lang } = usePrefs()
  const l = lang as Lang
  const doc = legal[kind]
  return (
    <div>
      <PageHeader back="/account" title={doc.title[l]} />
      <div className="page-narrow px-g space-y-4 pb-8">
        <section className="card overflow-hidden">
          <div className="h-1.5 sanad-stripe" />
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-2">{t('lastUpdated')} · <bdi dir="ltr">{legal.updated}</bdi></p>
            <p className="mt-2 text-sm leading-7">{doc.intro[l]}</p>
          </div>
        </section>
        {doc.sections.map(s => (
          <section key={s.h.en} className="card p-5">
            <h2 className="text-base font-extrabold">{s.h[l]}</h2>
            <ul className="mt-2 space-y-2">
              {s.p[l].map((x, i) => (
                <li key={i} className="flex gap-2 text-sm leading-7 text-2"><span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-[var(--color-brand)]" />{x}</li>
              ))}
            </ul>
          </section>
        ))}
        {kind === 'privacy' && (
          <section className="card p-5">
            <h2 className="text-base font-extrabold">{legal.privacy.delete.h[l]}</h2>
            <p className="mt-2 text-sm leading-7 text-2">{legal.privacy.delete.p[l]}</p>
          </section>
        )}
        <section className="card flex flex-col gap-2 p-5 sm:flex-row">
          <a href={`mailto:${legal.email}`} className="btn btn-ghost flex-1"><Mail className="size-5" /><bdi dir="ltr">{legal.email}</bdi></a>
          <a href={`./${kind}.html`} target="_blank" rel="noreferrer" className="btn btn-ghost flex-1"><ExternalLink className="size-5" />{t('openWebVersion')}</a>
        </section>
      </div>
    </div>
  )
}
