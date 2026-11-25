import { useEffect, useRef, useState } from 'react'
import { Bell, Camera, Send, Smartphone, X } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useToast } from '../../context/ToastContext'
import { useCategories } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { PRESETS, uploadOptimized } from '../../lib/image'
import { Spinner } from '../../components/ui'
import { assetUrl, dateTime } from '../../lib/format'
import type { AppNotification } from '../../lib/types'

export default function AdminNotify() {
  const { t, lang, catName } = usePrefs()
  const toast = useToast()
  const { categories } = useCategories()
  const fileRef = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({ title: '', body: '', image_url: '', link: '' })
  const [busy, setBusy] = useState<'send' | 'upload' | null>(null)
  const [devices, setDevices] = useState<number | null>(null)
  const [history, setHistory] = useState<AppNotification[] | null>(null)

  async function load() {
    const [d, h] = await Promise.all([
      supabase.from('push_tokens').select('token', { count: 'exact', head: true }),
      supabase.from('notifications').select('*').is('target_user', null).order('created_at', { ascending: false }).limit(30)
    ])
    setDevices(d.count ?? 0)
    setHistory((h.data as AppNotification[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function upload(file: File) {
    setBusy('upload')
    try {
      const url = await uploadOptimized(file, 'notifications', PRESETS.banner)
      setF(s => ({ ...s, image_url: url }))
    } catch (e) { toast((e as Error).message, 'error') }
    setBusy(null)
  }

  async function send() {
    if (!f.title.trim() || !f.body.trim()) return
    if (!confirm(`${t('sendToAll')}?`)) return
    setBusy('send')
    const { data, error } = await supabase.functions.invoke('send-push', { body: { action: 'broadcast', ...f } })
    setBusy(null)
    if (error || data?.error) { toast(error?.message || data.error, 'error'); return }
    toast(data.configured ? `${t('sentTo')} ${data.sent} ${t('devices')}` : t('pushNotConfigured'))
    setF({ title: '', body: '', image_url: '', link: '' })
    load()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{t('sendNotification')}</h2>
          <span className="chip surface-2 text-2"><Smartphone className="size-3.5" />{devices ?? '…'} {t('devices')}</span>
        </div>
        <div><label className="label">{t('notifTitle')} *</label><input maxLength={120} className="field" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
        <div>
          <label className="label">{t('notifBody')} *</label>
          <textarea rows={4} maxLength={1000} className="field resize-none" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
          <p className="mt-1 text-end text-[11px] text-2" dir="ltr">{f.body.length}/1000</p>
        </div>
        <div>
          <p className="label">{t('image')}</p>
          {f.image_url ? (
            <div className="relative overflow-hidden rounded-2xl border border-theme">
              <img src={f.image_url} alt="" className="max-h-48 w-full bg-white object-cover" />
              <button aria-label="remove" onClick={() => setF({ ...f, image_url: '' })} className="absolute end-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white"><X className="size-4" /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="btn btn-ghost w-full py-6">{busy === 'upload' ? <Spinner /> : <Camera className="size-5" />}{t('uploadImage')}</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const x = e.target.files?.[0]; if (x) upload(x); e.target.value = '' }} />
        </div>
        <div>
          <label className="label">{t('notifLink')}</label>
          <select className="field" value={f.link} onChange={e => setF({ ...f, link: e.target.value })}>
            <option value="">{t('linkNone')}</option>
            {categories?.map(c => <option key={c.id} value={`/c/${c.slug}`}>{catName(c)}</option>)}
            <option value="/orders">{t('orders')}</option>
          </select>
        </div>
        <button disabled={!!busy || !f.title.trim() || !f.body.trim()} onClick={send} className="btn btn-primary w-full py-4 text-base">
          {busy === 'send' ? <Spinner /> : <Send className="size-5 rtl:-scale-x-100" />}{t('sendToAll')}
        </button>
      </section>

      <div className="space-y-4">
        <section className="card p-5">
          <p className="label">{t('preview')}</p>
          <div className="rounded-3xl bg-gradient-to-br from-slate-800 to-slate-950 p-4">
            <div className="rounded-2xl bg-white/95 p-3 text-ink shadow-xl">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                <img src={assetUrl('icons/icon-192.png')} alt="" className="size-4 rounded" /> Sanad Order · now
              </div>
              <p className="mt-1 font-extrabold">{f.title || t('notifTitle')}</p>
              <p className="line-clamp-3 text-sm text-gray-600">{f.body || t('notifBody')}</p>
              {f.image_url && <img src={f.image_url} alt="" className="mt-2 max-h-32 w-full rounded-xl object-cover" />}
            </div>
          </div>
        </section>
        <section className="card p-5">
          <h3 className="mb-3 font-extrabold">{t('history')}</h3>
          {history?.length === 0 && <p className="text-sm text-2">—</p>}
          <ul className="space-y-3">
            {history?.map(n => (
              <li key={n.id} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl surface-2"><Bell className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{n.title}</p>
                  <p className="truncate text-xs text-2">{n.body}</p>
                  <p className="text-[11px] text-2">{dateTime(n.created_at, lang)} · {t('sentTo')} {n.push_sent} {t('devices')}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
