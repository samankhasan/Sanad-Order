// Sanad Order — account management
//   { action: "delete_me" }                                  any signed-in user: permanently deletes own account (Google Play requirement)
//   { action: "admin_set_password", user_id, password }      admin only: reset a customer's password (phone accounts have no e-mail)
//   { action: "admin_get_user", user_id }                    admin only: the member's sign-in e-mail
//   { action: "admin_set_email", user_id, email }            admin only: change the member's sign-in e-mail
//   { action: "admin_block", user_id, blocked }              admin only: block / unblock (auth ban + profiles.blocked_at + devices/IPs/phone/e-mail)
//   { action: "admin_delete_user", user_id }                 admin only: permanently delete a member (orders cascade)
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u.user) return json({ error: 'unauthorized' }, 401)
    const body = await req.json()

    if (body.action === 'delete_me') {
      const { error } = await admin.auth.admin.deleteUser(u.user.id) // profile, orders, tokens cascade
      if (error) throw error
      return json({ ok: true })
    }

    if (String(body.action).startsWith('admin_')) {
      const { data: me } = await admin.from('profiles').select('role').eq('id', u.user.id).single()
      if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403)
    }
    const target = String(body.user_id ?? '')
    // block / delete: never yourself, never another admin (remove the admin role first)
    async function guardTarget() {
      if (!target || target === u.user!.id) return 'not_allowed_on_self'
      const { data: p } = await admin.from('profiles').select('role').eq('id', target).single()
      if (!p) return 'not_found'
      if (p.role === 'admin') return 'remove_admin_first'
      return null
    }

    if (body.action === 'admin_get_user') {
      const { data, error } = await admin.auth.admin.getUserById(target)
      if (error) throw error
      return json({ email: data.user.email ?? null, banned_until: (data.user as { banned_until?: string }).banned_until ?? null, last_sign_in_at: data.user.last_sign_in_at ?? null })
    }

    if (body.action === 'admin_set_email') {
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400)
      const { error } = await admin.auth.admin.updateUserById(target, { email, email_confirm: true })
      if (error) throw error
      return json({ ok: true })
    }

    if (body.action === 'admin_block') {
      const bad = await guardTarget(); if (bad) return json({ error: bad }, 400)
      const blocked = !!body.blocked
      const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: blocked ? '876000h' : 'none' })
      if (error) throw error
      const { error: pe } = await admin.from('profiles').update({ blocked_at: blocked ? new Date().toISOString() : null }).eq('id', target)
      if (pe) throw pe
      // also block the person's devices, recent IPs, phone and e-mail so they cannot come back under a new account
      const { error: be } = await admin.rpc('set_member_block', { p_user: target, p_blocked: blocked })
      if (be) throw be
      if (blocked) await admin.from('push_tokens').delete().eq('user_id', target)
      return json({ ok: true })
    }

    if (body.action === 'admin_delete_user') {
      const bad = await guardTarget(); if (bad) return json({ error: bad }, 400)
      const { error } = await admin.auth.admin.deleteUser(target)
      if (error) throw error
      return json({ ok: true })
    }

    if (body.action === 'admin_set_password') {
      const pw = String(body.password ?? '')
      if (pw.length < 6) return json({ error: 'password_too_short' }, 400)
      const { error } = await admin.auth.admin.updateUserById(target, { password: pw })
      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
