// Sanad Order — account management
//   { action: "delete_me" }                                  any signed-in user: permanently deletes own account (Google Play requirement)
//   { action: "admin_set_password", user_id, password }      admin only: reset a customer's password (phone accounts have no e-mail)
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

    if (body.action === 'admin_set_password') {
      const { data: me } = await admin.from('profiles').select('role').eq('id', u.user.id).single()
      if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403)
      const pw = String(body.password ?? '')
      if (pw.length < 6) return json({ error: 'password_too_short' }, 400)
      const { error } = await admin.auth.admin.updateUserById(String(body.user_id), { password: pw })
      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
