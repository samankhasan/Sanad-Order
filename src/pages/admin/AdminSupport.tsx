import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCheck, Inbox, MessageCircle, Phone, RotateCcw, Send, Trash2 } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { notify } from '../../lib/push'
import { ErrorBox, Skeleton, Spinner } from '../../components/ui'
import { cn, dateTime } from '../../lib/format'
import { whatsappLink } from '../../lib/contact'
import type { SupportMessage } from '../../lib/types'

type Filter = 'open' | 'closed' | 'all'

function Thread({ m, onChanged }: { m: SupportMessage; onChanged: () => void }) {
  const { t, lang } = usePrefs()
  const { session, isAdmin: canDelete } = useAuth()
  const toast = useToast()
  const [reply, setReply] = useState(m.reply ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const p = m.profiles

  async function update(fields: Partial<SupportMessage> & { replied_by?: string | null }, key: string) {
    setBusy(key)
    const { error } = await supabase.from('support_messages').update(fields).eq('id', m.id)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return false }
    onChanged(); return true
  }
  async function sendReply() {
    const text = reply.trim()
    if (!text) return
    if (await update({ reply: text, replied_by: session?.user.id ?? null, replied_at: new Date().toISOString(), status: 'closed' }, 'reply')) {
      notify({ action: 'support_reply', message_id: m.id })
      toast(t('messageSent'))
    }
  }
  async function remove() {
    if (!confirm(t('deleteMessageConfirm'))) return
    setBusy('delete')
    const { error } = await supabase.from('support_messages').delete().eq('id', m.id)
    setBusy(null)
    if (error) toast(error.message, 'error'); else onChanged()
  }

  return (
    <article className={cn('card space-y-3 p-4', m.status === 'open' && 'ring-2 ring-[var(--color-brand)]/30')}>
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl surface-2 font-black">
          {p?.avatar_url ? <img src={p.avatar_url} alt="" className="size-full object-cover" /> : (p?.full_name || '?').slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">{p?.full_name || '—'}</p>
          <p className="text-[11px] text-2">{dateTime(m.created_at, lang)}{p?.username && <bdi dir="ltr"> · @{p.username}</bdi>}</p>
        </div>
        {p?.phone && <>
          <a href={whatsappLink(p.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid size-10 place-items-center rounded-xl bg-[#25D366] text-white"><MessageCircle className="size-5" /></a>
          <a href={`tel:+${p.phone}`} aria-label={t('call')} className="grid size-10 place-items-center rounded-xl surface-2"><Phone className="size-5" /></a>
        </>}
      </div>
      <p className="whitespace-pre-line rounded-2xl surface-2 p-3 text-sm leading-7">{m.body}</p>
      <div className="space-y-2">
        <textarea rows={2} maxLength={2000} value={reply} onChange={e => setReply(e.target.value)} placeholder={t('writeReply')} className="field resize-none text-sm" />
        <div className="flex flex-wrap items-center gap-1">
          <button disabled={!!busy || !reply.trim() || reply.trim() === (m.reply ?? '')} onClick={sendReply} className="btn btn-primary min-h-11 px-4 text-sm">
            {busy === 'reply' ? <Spinner /> : <Send className="size-4 rtl:-scale-x-100" />}{m.reply ? t('updateReply') : t('sendReply')}
          </button>
          {m.status === 'open'
            ? <button disabled={!!busy} onClick={() => update({ status: 'closed' }, 'close')} className="btn btn-ghost min-h-11 px-3 text-sm"><CheckCheck className="size-4" />{t('markDone')}</button>
            : <button disabled={!!busy} onClick={() => update({ status: 'open' }, 'open')} className="btn btn-ghost min-h-11 px-3 text-sm"><RotateCcw className="size-4" />{t('reopen')}</button>}
          {canDelete && <button disabled={!!busy} onClick={remove} aria-label={t('delete')} className="ms-auto grid size-11 place-items-center rounded-xl text-rose-600 active:bg-[var(--surface-2)]"><Trash2 className="size-4" /></button>}
        </div>
        {m.replied_at && <p className="text-[11px] text-2">{t('replied')} · {dateTime(m.replied_at, lang)}</p>}
      </div>
    </article>
  )
}

/** Admin inbox for members' support messages. */
export default function AdminSupport() {
  const { t } = usePrefs()
  const [rows, setRows] = useState<SupportMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('support_messages').select('*, profiles!support_messages_user_id_fkey(full_name, phone, username, avatar_url)').order('created_at', { ascending: false }).limit(300)
    if (error) setError(error.message); else setRows(data as SupportMessage[])
  }, [])
  useEffect(() => {
    load()
    const ch = supabase.channel('admin-support').on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const counts = useMemo(() => ({ open: rows?.filter(r => r.status === 'open').length ?? 0, closed: rows?.filter(r => r.status === 'closed').length ?? 0, all: rows?.length ?? 0 }), [rows])
  const list = (rows ?? []).filter(r => filter === 'all' || r.status === filter)

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {([['open', t('openMessages')], ['closed', t('doneMessages')], ['all', t('allMembers')]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn('filter-chip', filter === k && '!border-transparent !bg-[var(--primary)] !text-[var(--on-primary)]')}>
            {label} <span className="opacity-70" dir="ltr">{counts[k]}</span>
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && <Skeleton className="h-64 rounded-3xl" />}
      {rows && list.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-2"><Inbox className="size-10" /><p className="text-sm font-semibold">{t('noMessagesYet')}</p></div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map(m => <Thread key={m.id} m={m} onChanged={load} />)}
      </div>
    </div>
  )
}
