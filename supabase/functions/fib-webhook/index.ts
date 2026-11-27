// Sanad Order — FIB (First Iraqi Bank) payment status callback ("statusCallbackUrl").
// Placeholder until the FIB merchant credentials arrive: it acknowledges FIB's calls (HTTP 200) and
// changes nothing. The real handler will re-check the payment with the FIB API before marking an
// order as paid — a callback alone is never trusted.
Deno.serve(req => {
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, service: 'sanad-order fib-webhook' }), { headers: { 'Content-Type': 'application/json' } })
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})
