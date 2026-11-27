// Sanad Company contact numbers (support, invoices)
export const SUPPORT_PHONES = [
  { e164: '9647508418593', display: '+964 750 841 8593' },
  { e164: '9647514446665', display: '+964 751 444 6665' }
] as const

export const whatsappLink = (e164: string, text?: string) =>
  `https://wa.me/${e164}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export const COMPANY_WEBSITE = 'https://www.sanadcompany.com'

export const COMPANY_EMAIL = 'app@sanadcompany.com'
export const CAREERS_PHONE = { e164: '9647508418593', display: '+964 750 841 8593' } as const
