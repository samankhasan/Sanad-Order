import { useState } from 'react'
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { usePrefs } from '../../context/PrefsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { mapsLink, useAddresses } from '../../lib/data'
import { PageHeader, Sheet, Skeleton } from '../../components/ui'
import AddressForm from '../../components/address/AddressForm'
import { AddressIcon, AddressSummary } from '../../components/address/AddressCard'
import type { Address } from '../../lib/types'

/** Account → My addresses: saved delivery locations (add, edit, delete, choose the default). */
export default function Addresses() {
  const { t } = usePrefs()
  const { session } = useAuth()
  const toast = useToast()
  const { addresses, reload } = useAddresses(session?.user.id)
  const [editing, setEditing] = useState<Address | 'new' | null>(null)

  async function makeDefault(a: Address) {
    if (!session) return
    await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', session.user.id).eq('is_default', true)
    const { error } = await supabase.from('user_addresses').update({ is_default: true }).eq('id', a.id)
    if (error) toast(error.message, 'error'); else { toast(t('saved')); reload() }
  }
  async function remove(a: Address) {
    if (!confirm(`${a.label}\n${t('deleteAddressConfirm')}`)) return
    const { error } = await supabase.from('user_addresses').delete().eq('id', a.id)
    if (error) toast(error.message, 'error'); else reload()
  }

  return (
    <div>
      <PageHeader back="/account" title={t('myAddresses')} />
      <div className="page-narrow px-g space-y-3 pb-6">
        <button onClick={() => setEditing('new')} className="btn btn-primary min-h-12 w-full"><Plus className="size-5" />{t('newAddress')}</button>
        {!addresses && <Skeleton className="h-28 rounded-3xl" />}
        {addresses?.length === 0 && (
          <div className="card flex flex-col items-center gap-3 px-8 py-12 text-center text-2"><MapPin className="size-10" /><p className="text-sm leading-7">{t('addDeliveryLocationHint')}</p></div>
        )}
        {addresses?.map(a => (
          <article key={a.id} className="card p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl surface-2"><AddressIcon label={a.label} className="size-5" /></span>
              <AddressSummary a={a} />
              {a.is_default && <span className="chip shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Star className="size-3.5" fill="currentColor" />{t('addrDefaultShort')}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-0.5 border-t border-theme pt-2">
              <button onClick={() => setEditing(a)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-brand active:bg-[var(--surface-2)]"><Pencil className="size-4" />{t('edit')}</button>
              {a.lat != null && a.lng != null && <a href={mapsLink(a.lat, a.lng)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-2 active:bg-[var(--surface-2)]"><MapPin className="size-4" />{t('openInMaps')}</a>}
              {!a.is_default && <button onClick={() => makeDefault(a)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-2 active:bg-[var(--surface-2)]"><Star className="size-4" />{t('addrDefaultShort')}</button>}
              <button onClick={() => remove(a)} aria-label={t('delete')} className="ms-auto grid size-11 place-items-center rounded-xl text-rose-600 active:bg-[var(--surface-2)]"><Trash2 className="size-4" /></button>
            </div>
          </article>
        ))}
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        {editing && <AddressForm address={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => reload()} />}
      </Sheet>
    </div>
  )
}
