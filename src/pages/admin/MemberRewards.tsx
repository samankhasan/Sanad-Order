import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, Gift, Send, Trash2, X } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { notify } from '../../lib/push'
import { PRESETS, uploadOptimized } from '../../lib/image'
import { Spinner } from '../../components/ui'
import { dateTime } from '../../lib/format'
import type { Profile, Reward } from '../../lib/types'

/** Admin: give a member a reward (title, details, picture) — they get a notification — and remove rewards. */
export default function MemberRewards({ member }: { member: Profile }) {
  const { t, lang } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [list, setList] = useState<Reward[] | null>(null)
  const [f, setF] = useState({ title: '', body: '', image_url: '' })
  const [busy, setBusy] = useState<'save' | 'upload' | string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('rewards').select('*').eq('user_id', member.id).order('created_at', { ascending: false })
    setList((data as Reward[]) ?? [])
  }, [member.id])
  useEffect(() => { load() }, [load])

  async function upload(file: File) {
    setBusy('upload')
    try { const url = await uploadOptimized(file, 'rewards', PRESETS.banner); setF(s => ({ ...s, image_url: url })) }
    catch (e) { toast((e as Error).message, 'error') }
    setBusy(null)
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy('save')
    const row = { user_id: member.id, title: f.title.trim(), body: f.body.trim() || null, image_url: f.image_url || null, created_by: session?.user.id }
    const { error } = await supabase.from('rewards').insert(row)
    setBusy(null)
    if (error) { toast(error.message, 'error'); return }
    notify({ action: 'broadcast', title: `🎁 ${row.title}`.slice(0, 120), body: (row.body || row.title).slice(0, 1000), image_url: row.image_url, link: '/account/rewards', target_user: member.id })
    setF({ title: '', body: '', image_url: '' }); toast(t('rewardSent')); load()
  }
  async function remove(r: Reward) {
    if (!confirm(`${r.title}\n${t('deleteRewardConfirm')}`)) return
    setBusy(r.id)
    const { error } = await supabase.from('rewards').delete().eq('id', r.id)
    setBusy(null)
    if (error) toast(error.message, 'error'); else load()
  }

  return (
    <div className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><Gift className="size-5" />{t('giveReward')} · <span className="truncate text-2">{member.full_name}</span></h2>
      <form onSubmit={save} className="space-y-3">
        <input required maxLength={120} className="field" placeholder={t('rewardTitle')} aria-label={t('rewardTitle')} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        <textarea rows={3} maxLength={1000} className="field resize-none" placeholder={t('rewardBody')} aria-label={t('rewardBody')} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
        {f.image_url
          ? <div className="relative overflow-hidden rounded-2xl border border-theme"><img src={f.image_url} alt="" className="aspect-[2/1] w-full object-cover" /><button type="button" aria-label="remove" onClick={() => setF({ ...f, image_url: '' })} className="absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-black/60 text-white"><X className="size-4" /></button></div>
          : <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn btn-ghost w-full">{busy === 'upload' ? <Spinner /> : <Camera className="size-5" />}{t('uploadImage')}</button>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) upload(x); e.target.value = '' }} />
        <button disabled={!!busy || !f.title.trim()} className="btn btn-primary min-h-13 w-full">{busy === 'save' ? <Spinner /> : <Send className="size-5 rtl:-scale-x-100" />}{t('giveReward')}</button>
      </form>

      <div>
        <p className="label">{t('memberRewards')} {list && <bdi dir="ltr">({list.length})</bdi>}</p>
        {list?.length === 0 && <p className="rounded-2xl surface-2 p-4 text-center text-sm text-2">—</p>}
        <ul className="space-y-2">
          {list?.map(r => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl surface-2 p-2.5">
              {r.image_url ? <img src={r.image_url} alt="" className="size-12 shrink-0 rounded-xl object-cover" /> : <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amber-400 text-white"><Gift className="size-5" /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.title}</p>
                <p className="text-[11px] text-2">{dateTime(r.created_at, lang)}</p>
              </div>
              <button onClick={() => remove(r)} disabled={busy === r.id} aria-label={t('delete')} className="grid size-10 place-items-center rounded-xl text-rose-600">{busy === r.id ? <Spinner /> : <Trash2 className="size-4" />}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
