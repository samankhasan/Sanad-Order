/** Password rules shared by sign-up, reset, change and staff-created accounts. */
export const PW_MIN = 8

export type PwIssue = 'pwTooShort' | 'pwNeedsMix' | 'pwCommon' | 'pwLeaked'

// a handful of the most-used passwords, checked offline before the leak lookup
const COMMON = new Set(['12345678', '123456789', '1234567890', 'password', 'password1', 'qwertyui', 'qwerty123', '11111111', '00000000', '12341234', '87654321', 'iloveyou', 'abc12345', 'abcd1234', 'a1234567', 'aa123456', 'sanad123', 'sanad1234'])

/** 0–4: too weak · weak · fair · good · strong (length + variety; no network) */
export function pwScore(pw: string): number {
  if (!pw) return 0
  let s = 0
  if (pw.length >= PW_MIN) s++
  if (pw.length >= 12) s++
  if (/[a-z]/i.test(pw) && /\d/.test(pw)) s++
  if (/[^a-z0-9]/i.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++
  if (pw.length < PW_MIN || COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) s = Math.min(s, 1)
  return Math.min(4, s)
}

/** Rule check that needs no network. */
export function pwRuleIssue(pw: string): PwIssue | null {
  if (pw.length < PW_MIN) return 'pwTooShort'
  if (!/[a-z؀-ۿ]/i.test(pw) || !/[0-9٠-٩۰-۹]/.test(pw)) return 'pwNeedsMix'
  if (COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return 'pwCommon'
  return null
}

/**
 * Has this password appeared in a known data breach? Uses the Have I Been Pwned range API (k-anonymity):
 * only the first 5 characters of the password's SHA-1 hash leave the device — never the password.
 * If the service cannot be reached, the check is skipped (returns false).
 */
export async function pwLeaked(pw: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw))
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 5000)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { signal: ctl.signal })
    clearTimeout(timer)
    if (!res.ok) return false
    const suffix = hex.slice(5)
    return (await res.text()).split('\n').some(line => {
      const [h, n] = line.trim().split(':')
      return h === suffix && Number(n) > 0
    })
  } catch { return false }
}

/** Full check for a new password: rules first, then the breach lookup. */
export async function checkNewPassword(pw: string): Promise<PwIssue | null> {
  return pwRuleIssue(pw) ?? ((await pwLeaked(pw)) ? 'pwLeaked' : null)
}
