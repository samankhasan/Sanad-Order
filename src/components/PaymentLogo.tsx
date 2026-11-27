import { Banknote, CreditCard } from 'lucide-react'
import { cn } from '../lib/format'
import type { PaymentMethod } from '../lib/types'

/** The payment method's own logo (uploaded by the admin); cash has a banknote; others fall back to a neutral card mark. */
export default function PaymentLogo({ method, className }: { method?: Pick<PaymentMethod, 'code' | 'logo_url' | 'name_en'> | null; className?: string }) {
  if (method?.logo_url) return <img src={method.logo_url} alt={method.name_en} className={cn('rounded-xl bg-white object-contain p-1 ring-1 ring-black/5', className)} />
  if (method?.code === 'cash') return <span className={cn('grid place-items-center rounded-xl bg-emerald-500 text-white', className)}><Banknote className="size-[55%]" /></span>
  return <span className={cn('grid place-items-center rounded-xl surface-2 text-2', className)}><CreditCard className="size-[50%]" /></span>
}

export function paymentName(m: Pick<PaymentMethod, 'name_ku' | 'name_ar' | 'name_en'> | undefined | null, lang: string) {
  if (!m) return ''
  return lang === 'ar' ? m.name_ar : lang === 'en' ? m.name_en : m.name_ku
}
