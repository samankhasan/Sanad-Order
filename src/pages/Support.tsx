import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCheck, Clock, MessageCircle, Phone, Send, ShieldCheck } from 'lucide-react'
import { usePrefs } from '../context/PrefsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/push'
import { PageHeader, Skeleton, Spinner } from '../components/ui'
import { dateTime } from '../lib/format'
import { SUPPORT_PHONES, whatsappLink } from '../lib/contact'
import type { SupportMessage } from '../lib/types'

/** Help & contact: registered members message the company or reach it on WhatsApp / by phone. */
export default function Support() {
  const { t, lang } = usePrefs()
  const { session, profile } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [list, setList] = useState<SupportMessage[] | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    const { data } = await supabase.from('support_messages').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50)
    setList((data as SupportMessage[]) ?? [])
  }, [session])
  useEffect(() => {
    load()
    if (!session) return
    const ch = supabase.channel('my-support').on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `user_id=eq.${session.user.id}` }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, session])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!session || !text.trim()) return
    setBusy(true)
    const { data, error } = await supabase.from('support_messages').insert({ user_id: session.user.id, body: text.trim() }).select().single()
    setBusy(false)
    if (error) { toast(/too_many_messages/.test(error.message) ? t('tooManyMessages') : error.message, 'error'); return }
    notify({ action: 'support_message', message_id: (data as SupportMessage).id })
    setText('')
    toast(t('messageSent'))
    load()
  }

  const greeting = `${t('supportWhatsappIntro')} ${profile?.full_name ?? ''}`.trim()

  return (
    <div>
      <PageHeader back title={t('support')} />
      <div className="page-narrow px-g space-y-4 pb-6">
        <section className="card overflow-hidden">
          <div className="bg-ink p-5 text-white">
            <p className="text-lg font-extrabold">{t('supportTitle')}</p>
            <p className="mt-1 text-sm text-white/70">{t('supportHint')}</p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {SUPPORT_PHONES.map(p => (
              <li key={p.e164} className="flex items-center gap-2 p-3">
                <bdi dir="ltr" className="flex-1 whitespace-nowrap ps-1 text-sm font-extrabold tabular-nums">{p.display}</bdi>
                <a href={whatsappLink(p.e164, greeting)} target="_blank" rel="noreferrer" className="btn min-h-11 bg-[#25D366] px-3 text-sm text-white"><MessageCircle className="size-4" />WhatsApp</a>
                <a href={`tel:+${p.e164}`} aria-label={t('call')} className="btn btn-ghost min-h-11 px-3"><Phone className="size-4" /></a>
              </li>
            ))}
          </ul>
        </section>

        <form onSubmit={send} className="card space-y-3 p-5">
          <h2 className="font-extrabold">{t('sendUsMessage')}</h2>
          <textarea required rows={4} maxLength={2000} value={text} onChange={e => setText(e.target.value)} className="field resize-none" placeholder={t('messagePlaceholder')} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-2" dir="ltr">{text.length}/2000</span>
            <button disabled={busy || !text.trim()} className="btn btn-primary min-h-12 px-5">{busy ? <Spinner /> : <Send className="size-5 rtl:-scale-x-100" />}{t('send')}</button>
          </div>
        </form>

        <section className="space-y-2">
          <h2 className="px-1 font-extrabold">{t('myMessages')}</h2>
          {!list && <Skeleton className="h-28 rounded-3xl" />}
          {list?.length === 0 && <p className="card p-6 text-center text-sm text-2">{t('noMessagesYet')}</p>}
          {list?.map(m => (
            <article key={m.id} className="card space-y-3 p-4">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-2">
                <span>{dateTime(m.created_at, lang)}</span>
                {m.reply
                  ? <span className="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCheck className="size-3.5" />{t('replied')}</span>
                  : <span className="chip surface-2"><Clock className="size-3.5" />{t('awaitingReply')}</span>}
              </div>
              <p className="whitespace-pre-line text-sm leading-7">{m.body}</p>
              {m.reply && (
                <div className="rounded-2xl border-s-4 border-emerald-500 surface-2 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300"><ShieldCheck className="size-4" />Sanad Company{m.replied_at && <span className="font-semibold text-2">· {dateTime(m.replied_at, lang)}</span>}</p>
                  <p className="whitespace-pre-line text-sm leading-7">{m.reply}</p>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
