// Builds public/privacy.html and public/terms.html from src/content/legal.json
// (the same text the app shows), so the public pages linked from Google Play never drift.
// Run: npm run legal
import { readFileSync, writeFileSync } from 'node:fs'

const L = JSON.parse(readFileSync(new URL('../src/content/legal.json', import.meta.url), 'utf8'))
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const LANGS = [['en', 'English', 'ltr'], ['ku', 'کوردی', 'rtl'], ['ar', 'العربية', 'rtl']]

function page(kind) {
  const doc = L[kind]
  const other = kind === 'privacy' ? ['terms.html', L.terms.title] : ['privacy.html', L.privacy.title]
  const blocks = LANGS.map(([code, , dir]) => `
  <section id="${code}" dir="${dir}" lang="${code === 'ku' ? 'ckb' : code}">
    <h2 class="t">${esc(doc.title[code])}</h2>
    <p>${esc(doc.intro[code])}</p>
    ${doc.sections.map(s => `<h3>${esc(s.h[code])}</h3><ul>${s.p[code].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('\n    ')}
    <h3>${code === 'ku' ? 'پەیوەندی' : code === 'ar' ? 'التواصل' : 'Contact'}</h3>
    <p>Sanad Company · <a href="mailto:${L.email}">${L.email}</a> · <span dir="ltr">${L.phone}</span></p>
  </section>`).join('\n')
  const del = kind === 'privacy' ? `
  <section id="delete">
    <h2 class="t">${LANGS.map(([c]) => esc(doc.delete.h[c])).join(' · ')}</h2>
    ${LANGS.map(([c, , dir]) => `<p dir="${dir}">${esc(doc.delete.p[c])}</p>`).join('\n    ')}
    <p><a href="mailto:${L.email}?subject=Delete%20my%20account">${L.email}</a></p>
  </section>` : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sanad Order — ${esc(doc.title.en)}</title>
<link rel="icon" href="favicon.png" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;700&display=swap" rel="stylesheet" />
<style>
  :root { --bg:#f5f6fa; --card:#fff; --text:#0b1220; --muted:#5b6474; --border:#e3e6ed; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root { --bg:#070b14; --card:#0f1625; --text:#eef2f8; --muted:#97a3b8; --border:#212c43; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.8 "Noto Kufi Arabic", system-ui, "Segoe UI", sans-serif; }
  main { max-width: 780px; margin: 0 auto; padding: 24px 16px 64px; }
  header { display:flex; align-items:center; gap:12px; }
  header img { width:52px; height:52px; border-radius:14px; }
  .stripe { height:6px; border-radius:3px; background:linear-gradient(90deg,#e10e19,#f36f21,#ffcb05,#4fa62f,#0284d6,#0b3c7d,#7b1b6a); margin: 14px 0 20px; }
  nav { display:flex; flex-wrap:wrap; gap:8px; margin-bottom: 16px; }
  nav a { padding:8px 14px; border-radius:12px; background:var(--card); border:1px solid var(--border); color:var(--text); text-decoration:none; font-weight:700; font-size:14px; }
  section { background:var(--card); border:1px solid var(--border); border-radius:20px; padding: 6px 22px 16px; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0; } .t { font-size: 19px; margin: 16px 0 6px; } h3 { font-size: 16px; margin: 18px 0 4px; }
  p, li { color: var(--muted); } li { margin: 4px 0; } a { color: #0284d6; }
  small { color: var(--muted); }
</style>
</head>
<body>
<main>
  <header><img src="icons/icon-192.png" alt="" /><div><h1>Sanad Order</h1><small>Sanad Company · ${esc(doc.title.en)} · Last updated ${L.updated}</small></div></header>
  <div class="stripe"></div>
  <nav>${LANGS.map(([c, n]) => `<a href="#${c}">${n}</a>`).join('')}${kind === 'privacy' ? '<a href="#delete">Delete account</a>' : ''}<a href="${other[0]}">${esc(other[1].en)}</a></nav>
${blocks}
${del}
</main>
</body>
</html>
`
}

writeFileSync(new URL('../public/privacy.html', import.meta.url), page('privacy'))
writeFileSync(new URL('../public/terms.html', import.meta.url), page('terms'))
console.log('public/privacy.html and public/terms.html written')
