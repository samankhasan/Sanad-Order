// Phone-number accounts without SMS: a phone is mapped to an internal e-mail address,
// so customers only need "phone + password". Real e-mail addresses keep working too.
export const PHONE_DOMAIN = 'phone.sanadorder.app'

/** 0750 123 4567 / +964 750… / 00964… / 750… → 9647501234567 */
export function normalizePhone(raw: string) {
  let d = raw.replace(/[^\d٠-٩۰-۹]/g, '')
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0))
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '964' + d.slice(1)
  else if (d.length === 10 && d.startsWith('7')) d = '964' + d
  return d
}

export function isEmail(v: string) { return /\S+@\S+\.\S+/.test(v.trim()) }

/** what the user typed (phone or e-mail) → the e-mail used by Supabase Auth */
export function toAuthEmail(identifier: string) {
  const v = identifier.trim()
  if (isEmail(v)) return v.toLowerCase()
  return `${normalizePhone(v)}@${PHONE_DOMAIN}`
}

export function isPhoneAccount(email?: string | null) { return !!email?.endsWith('@' + PHONE_DOMAIN) }

/** for display: 9647501234567@phone… → +964 750 123 4567 */
export function displayIdentity(email?: string | null, phone?: string | null) {
  if (!email) return ''
  if (!isPhoneAccount(email)) return email
  const d = phone ? normalizePhone(phone) : email.split('@')[0]
  return d.startsWith('964') && d.length === 13 ? `+964 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : '+' + d
}
