import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, CheckCircle2, Clock, EyeOff, Pencil, Plus, Trash2, Trophy, Users, X } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { notify } from '../../lib/push'
import { PRESETS, uploadOptimized } from '../../lib/image'
import { ErrorBox, Sheet, Skeleton, Spinner } from '../../components/ui'
import { cn, dateTime, money } from '../../lib/format'
import { goalText } from '../account/Challenges'
import type { Challenge, GoalType } from '../../lib/types'

type Row = { user_id: string; full_name: string | null; phone: string | null; avatar_url: string | null; joined_at: string; completed_at: string | null; progress: number }

/** <input type="datetime-local"> value in local time */
const toLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

function status(c: Challenge) {
  const now = Date.now()
  if (new Date(c.ends_at).getTime() <= now) return 'expired'
  if (new Date(c.starts_at).getTime() > now) return 'upcoming'
  return 'active'
}

function ChallengeForm({ c, onClose, onSaved }: { c: Challenge | null; onClose: () => void; onSaved: () => void }) {
  const { t } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const now = new Date()
  const [f, setF] = useState({
    title: c?.title ?? '', description: c?.description ?? '', reward_text: c?.reward_text ?? '', image_url: c?.image_url ?? '',
    goal_type: (c?.goal_type ?? 'orders_count') as GoalType, goal_value: c?.goal_value != null ? String(c.goal_value) : '5',
    starts_at: toLocal(c?.starts_at ?? now.toISOString()), ends_at: toLocal(c?.ends_at ?? new Date(now.getTime() + 14 * 864e5).toISOString()),
    is_active: c?.is_active ?? true, notifyAll: !c
  })
  const [busy, setBusy] = useState<'save' | 'upload' | null>(null)

  async function upload(file: File) {
    setBusy('upload')
    try { setF(s => ({ ...s, image_url: '' })); const url = await uploadOptimized(file, 'challenges', PRESETS.banner); setF(s => ({ ...s, image_url: url })) }
    catch (e) { toast((e as Error).message, 'error') }
    setBusy(null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy('save')
    const row = {
      title: f.title.trim(), description: f.description.trim() || null, reward_text: f.reward_text.trim() || null, image_url: f.image_url || null,
      goal_type: f.goal_type, goal_value: f.goal_type === 'custom' ? null : Number(f.goal_value) || null,
      starts_at: new Date(f.starts_at).toISOString(), ends_at: new Date(f.ends_at).toISOString(), is_active: f.is_active
    }
    const res = c
      ? await supabase.from('challenges').update(row).eq('id', c.id).select().single()
      : await supabase.from('challenges').insert({ ...row, created_by: session?.user.id }).select().single()
    setBusy(null)
    if (res.error) { toast(res.error.message, 'error'); return }
    if (f.notifyAll && f.is_active) notify({ action: 'broadcast', title: `🏆 ${row.title}`.slice(0, 120), body: (row.description || row.reward_text || row.title).slice(0, 1000), image_url: row.image_url, link: '/account/challenges' })
    toast(t('challengeSaved')); onSaved(); onClose()
  }

  return (
    <form onSubmit={save} className="space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><Trophy className="size-5" />{c ? t('editChallenge') : t('newChallenge')}</h2>
      <div className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-theme surface-2">
        {f.image_url ? <img src={f.image_url} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-2">{busy === 'upload' ? <Spinner /> : <Trophy className="size-10" />}</div>}
        {f.image_url && <button type="button" aria-label="remove" onClick={() => setF({ ...f, image_url: '' })} className="absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-black/60 text-white"><X className="size-4" /></button>}
      </div>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn btn-ghost w-full">{busy === 'upload' ? <Spinner /> : <Camera className="size-5" />}{f.image_url ? t('changeImage') : t('uploadImage')}</button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) upload(x); e.target.value = '' }} />
      <div><label className="label">{t('challengeTitle')} *</label><input required maxLength={120} className="field" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
      <div><label className="label">{t('challengeDesc')}</label><textarea rows={3} maxLength={2000} className="field resize-none" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
      <div><label className="label">{t('challengeReward')}</label><input maxLength={300} className="field" value={f.reward_text} onChange={e => setF({ ...f, reward_text: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">{t('goalType')}</label>
          <select className="field" value={f.goal_type} onChange={e => setF({ ...f, goal_type: e.target.value as GoalType })}>
            <option value="orders_count">{t('ch_goal_orders_count').replace('{n}', 'N')}</option>
            <option value="spend_total">{t('ch_goal_spend_total').replace('{n}', 'N')}</option>
            <option value="custom">{t('ch_goal_custom')}</option>
          </select>
        </div>
        {f.goal_type !== 'custom' && <div><label className="label">{t('goalValue')}</label><input required type="number" min={1} step="any" dir="ltr" className="field" value={f.goal_value} onChange={e => setF({ ...f, goal_value: e.target.value })} /></div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">{t('startsAt')}</label><input required type="datetime-local" dir="ltr" className="field" value={f.starts_at} onChange={e => setF({ ...f, starts_at: e.target.value })} /></div>
        <div><label className="label">{t('endsAt')}</label><input required type="datetime-local" dir="ltr" className="field" min={f.starts_at} value={f.ends_at} onChange={e => setF({ ...f, ends_at: e.target.value })} /></div>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-2 rounded-2xl surface-2 px-4 text-sm font-bold">{t('published')}<input type="checkbox" className="size-5 accent-[var(--primary)]" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} /></label>
      <label className="flex min-h-11 items-center justify-between gap-2 rounded-2xl surface-2 px-4 text-sm font-bold">{t('notifyAll')}<input type="checkbox" className="size-5 accent-[var(--primary)]" checked={f.notifyAll} onChange={e => setF({ ...f, notifyAll: e.target.checked })} /></label>
      <button disabled={!!busy} className="btn btn-primary min-h-14 w-full text-base">{busy === 'save' && <Spinner />}{t('save')}</button>
    </form>
  )
}

function Leaderboard({ c }: { c: Challenge }) {
  const { t, lang } = usePrefs()
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('challenge_leaderboard', { p_challenge: c.id })
    if (error) toast(error.message, 'error'); setRows((data as Row[]) ?? [])
  }, [c.id, toast])
  useEffect(() => { load() }, [load])

  async function toggle(r: Row) {
    const { error } = await supabase.from('challenge_participants').update({ completed_at: r.completed_at ? null : new Date().toISOString() }).eq('challenge_id', c.id).eq('user_id', r.user_id)
    if (error) toast(error.message, 'error'); else load()
  }
  const val = (n: number) => c.goal_type === 'spend_total' ? money(n, lang) : Number(n).toLocaleString('en-US')

  return (
    <div className="space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><Users className="size-5" />{t('leaderboard')} · <span className="truncate text-2">{c.title}</span></h2>
      {!rows && <Skeleton className="h-40 rounded-2xl" />}
      {rows?.length === 0 && <p className="rounded-2xl surface-2 p-6 text-center text-sm text-2">{t('noParticipants')}</p>}
      <ol className="space-y-2">
        {rows?.map((r, i) => {
          const done = !!r.completed_at || (c.goal_type !== 'custom' && !!c.goal_value && Number(r.progress) >= Number(c.goal_value))
          return (
            <li key={r.user_id} className={cn('flex items-center gap-3 rounded-2xl p-3', done ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'surface-2')}>
              <span className="w-6 text-center text-sm font-black text-2" dir="ltr">{i + 1}</span>
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl surface font-black">{r.avatar_url ? <img src={r.avatar_url} alt="" className="size-full object-cover" /> : (r.full_name || '?').slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.full_name || '—'}</p>
                <p className="text-[11px] text-2">{dateTime(r.joined_at, lang)}{c.goal_type !== 'custom' && <> · <b dir="ltr">{val(r.progress)}</b> / <span dir="ltr">{val(Number(c.goal_value))}</span></>}</p>
              </div>
              <button onClick={() => toggle(r)} className={cn('flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-2 text-[11px] font-bold', r.completed_at ? 'text-emerald-700 dark:text-emerald-300' : 'text-brand')}>
                <CheckCircle2 className="size-4" />{r.completed_at ? t('unmarkCompleted') : done ? t('ch_completed') : t('markCompleted')}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Admin → Challenges: announce challenges, see participants and their progress, mark winners. */
export default function AdminChallenges() {
  const { t, lang } = usePrefs()
  const toast = useToast()
  const [rows, setRows] = useState<(Challenge & { participants: { count: number }[] })[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Challenge | 'new' | null>(null)
  const [board, setBoard] = useState<Challenge | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('challenges').select('*, participants:challenge_participants(count)').order('ends_at', { ascending: false })
    if (error) setError(error.message); else setRows(data as never)
  }, [])
  useEffect(() => { load() }, [load])

  async function remove(c: Challenge) {
    if (!confirm(`${c.title}\n${t('deleteChallengeConfirm')}`)) return
    const { error } = await supabase.from('challenges').delete().eq('id', c.id)
    if (error) toast(error.message, 'error'); else load()
  }

  const chip: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    upcoming: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    expired: 'surface-2 text-2'
  }
  const label: Record<string, string> = { active: t('ch_active'), upcoming: t('ch_upcoming'), expired: t('ch_expired') }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-2">{rows?.length ?? 0} {t('challenges')}</p>
        <button onClick={() => setEditing('new')} className="btn btn-primary"><Plus className="size-5" />{t('newChallenge')}</button>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && <Skeleton className="h-60 rounded-3xl" />}
      {rows?.length === 0 && <div className="card flex flex-col items-center gap-2 p-10 text-center text-2"><Trophy className="size-10" /><p className="text-sm">{t('ch_emptyActive')}</p></div>}
      <div className="grid gap-3 lg:grid-cols-2">
        {rows?.map(c => {
          const s = status(c)
          return (
            <article key={c.id} className={cn('card overflow-hidden', !c.is_active && 'opacity-60')}>
              {c.image_url && <img src={c.image_url} alt="" className="aspect-[3/1] w-full object-cover" loading="lazy" />}
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 font-extrabold leading-snug">{!c.is_active && <EyeOff className="size-4 shrink-0 text-2" />}{c.title}</h3>
                  <span className={cn('chip shrink-0', chip[s])}>{label[s]}</span>
                </div>
                <p className="text-xs text-2">{goalText(c, t as (k: never) => string, lang)}{c.reward_text && ` · ${t('ch_reward')}: ${c.reward_text}`}</p>
                <p className="flex items-center gap-1.5 text-[11px] text-2"><Clock className="size-3.5" />{dateTime(c.starts_at, lang)} → {dateTime(c.ends_at, lang)}</p>
                <div className="flex flex-wrap items-center gap-1 border-t border-theme pt-2">
                  <button onClick={() => setBoard(c)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-brand active:bg-[var(--surface-2)]"><Users className="size-4" />{t('leaderboard')} <bdi dir="ltr">({c.participants?.[0]?.count ?? 0})</bdi></button>
                  <button onClick={() => setEditing(c)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-2 active:bg-[var(--surface-2)]"><Pencil className="size-4" />{t('edit')}</button>
                  <button onClick={() => remove(c)} aria-label={t('delete')} className="ms-auto grid size-11 place-items-center rounded-xl text-rose-600 active:bg-[var(--surface-2)]"><Trash2 className="size-4" /></button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        {editing && <ChallengeForm c={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={load} />}
      </Sheet>
      <Sheet open={!!board} onClose={() => setBoard(null)}>
        {board && <Leaderboard c={board} />}
      </Sheet>
    </div>
  )
}
