// Sanad Order — push notifications via Firebase Cloud Messaging (HTTP v1)
//
// Required secret (Supabase → Edge Functions → Secrets):
//   FIREBASE_SERVICE_ACCOUNT = full JSON of a Firebase service-account key
//
// Actions (POST JSON, with the user's Authorization header):
//   { action: "broadcast", title, body, image_url?, link?, target_user? }   admin only
//   { action: "order_status", order_id }                                     admin only → notifies the customer
//   { action: "new_order", order_id }                                        order owner → notifies all admins
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const STATUS_TEXT: Record<string, Record<string, string>> = {
  ku: { confirmed: 'داواکارییەکەت پەسەندکرا ✅', preparing: 'داواکارییەکەت ئامادە دەکرێت 📦', on_the_way: 'داواکارییەکەت لە ڕێگادایە 🚚', delivered: 'داواکارییەکەت گەیەندرا 🎉', cancelled: 'داواکارییەکەت هەڵوەشێنرایەوە', pending: 'داواکارییەکەت چاوەڕوانە' },
  ar: { confirmed: 'تم تأكيد طلبك ✅', preparing: 'طلبك قيد التجهيز 📦', on_the_way: 'طلبك في الطريق 🚚', delivered: 'تم توصيل طلبك 🎉', cancelled: 'تم إلغاء طلبك', pending: 'طلبك قيد الانتظار' },
  en: { confirmed: 'Your order was confirmed ✅', preparing: 'Your order is being prepared 📦', on_the_way: 'Your order is on the way 🚚', delivered: 'Your order was delivered 🎉', cancelled: 'Your order was cancelled', pending: 'Your order is pending' }
}

// ---------- Google OAuth access token from the service account ----------
let cached: { token: string; exp: number } | null = null
function b64url(data: ArrayBuffer | string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let s = ''
  bytes.forEach(b => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function accessToken(sa: { client_email: string; private_key: string }) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }))
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` })
  })
  const d = await res.json()
  if (!res.ok) throw new Error('google_oauth: ' + JSON.stringify(d))
  cached = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 }
  return cached.token
}

type Msg = { title: string; body: string; image_url?: string | null; link?: string | null; notification_id?: string }

async function pushToTokens(admin: ReturnType<typeof createClient>, tokens: string[], m: Msg) {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!raw || tokens.length === 0) return { sent: 0, failed: 0, configured: !!raw }
  const sa = JSON.parse(raw)
  const at = await accessToken(sa)
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  let sent = 0, failed = 0
  const dead: string[] = []
  const data: Record<string, string> = { link: m.link ?? '', notification_id: m.notification_id ?? '' }
  // send in parallel batches of 50
  for (let i = 0; i < tokens.length; i += 50) {
    await Promise.all(tokens.slice(i, i + 50).map(async token => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: m.title, body: m.body, ...(m.image_url ? { image: m.image_url } : {}) },
            data,
            android: { priority: 'HIGH', notification: { channel_id: 'sanad_default', sound: 'default', default_vibrate_timings: true } },
            apns: { payload: { aps: { sound: 'default' } } },
            webpush: { notification: { icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' } }
          }
        })
      })
      if (r.ok) { sent++; return }
      failed++
      const e = await r.json().catch(() => ({}))
      const code = JSON.stringify(e)
      if (r.status === 404 || code.includes('UNREGISTERED') || code.includes('registration-token-not-registered') || (r.status === 400 && code.includes('INVALID_ARGUMENT'))) dead.push(token)
    }))
  }
  if (dead.length) await admin.from('push_tokens').delete().in('token', dead)
  return { sent, failed, configured: true }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  // GET = health check: reports only whether Firebase is configured and Google accepts the key (no secrets returned)
  if (req.method === 'GET') {
    const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!raw) return json({ configured: false })
    try {
      const sa = JSON.parse(raw)
      await accessToken(sa)
      return json({ configured: true, project_id: sa.project_id, google_auth: 'ok' })
    } catch (e) {
      return json({ configured: true, google_auth: 'failed', reason: String((e as Error).message).slice(0, 200) })
    }
  }
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u.user) return json({ error: 'unauthorized' }, 401)
    const { data: me } = await admin.from('profiles').select('id, role').eq('id', u.user.id).single()
    const isAdmin = me?.role === 'admin'
    const body = await req.json()

    if (body.action === 'broadcast') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      const title = String(body.title ?? '').trim().slice(0, 120)
      const text = String(body.body ?? '').trim().slice(0, 1000)
      if (!title || !text) return json({ error: 'title_and_body_required' }, 400)
      const { data: n, error } = await admin.from('notifications').insert({
        title, body: text, image_url: body.image_url || null, link: body.link || null,
        target_user: body.target_user || null, created_by: me!.id
      }).select().single()
      if (error) throw error
      let q = admin.from('push_tokens').select('token')
      if (body.target_user) q = q.eq('user_id', body.target_user)
      const { data: rows } = await q
      const r = await pushToTokens(admin, (rows ?? []).map(x => x.token), { title, body: text, image_url: n.image_url, link: n.link, notification_id: n.id })
      await admin.from('notifications').update({ push_sent: r.sent, push_failed: r.failed }).eq('id', n.id)
      return json({ ok: true, notification: n, ...r })
    }

    if (body.action === 'order_status') {
      if (!isAdmin) return json({ error: 'forbidden' }, 403)
      const { data: o } = await admin.from('orders').select('id, order_no, status, user_id').eq('id', body.order_id).single()
      if (!o) return json({ error: 'not_found' }, 404)
      const { data: p } = await admin.from('profiles').select('lang').eq('id', o.user_id).single()
      const lang = (p?.lang && STATUS_TEXT[p.lang]) ? p.lang : 'ku'
      const title = `Sanad Order #${o.order_no}`
      const text = STATUS_TEXT[lang][o.status] ?? o.status
      const link = `/orders/${o.id}`
      const { data: n } = await admin.from('notifications').insert({ title, body: text, link, target_user: o.user_id, created_by: me!.id }).select().single()
      const { data: rows } = await admin.from('push_tokens').select('token').eq('user_id', o.user_id)
      const r = await pushToTokens(admin, (rows ?? []).map(x => x.token), { title, body: text, link, notification_id: n?.id })
      return json({ ok: true, ...r })
    }

    if (body.action === 'new_order') {
      const { data: o } = await admin.from('orders').select('id, order_no, total, user_id, profiles(full_name, shop_name)').eq('id', body.order_id).single()
      if (!o || o.user_id !== u.user.id) return json({ error: 'forbidden' }, 403)
      const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin')
      const ids = (admins ?? []).map(a => a.id)
      if (!ids.length) return json({ ok: true, sent: 0 })
      // deno-lint-ignore no-explicit-any
      const who = (o as any).profiles?.shop_name || (o as any).profiles?.full_name || ''
      const title = `🛒 داواکاری نوێ #${o.order_no}`
      const text = `${who} · ${Number(o.total).toLocaleString('en-US')} IQD`
      const link = `/orders/${o.id}`
      await admin.from('notifications').insert(ids.map(id => ({ title, body: text, link, target_user: id, created_by: u.user.id })))
      const { data: rows } = await admin.from('push_tokens').select('token').in('user_id', ids)
      const r = await pushToTokens(admin, (rows ?? []).map(x => x.token), { title, body: text, link })
      return json({ ok: true, ...r })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
