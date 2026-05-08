#!/usr/bin/env node
/**
 * ProQuote 2.1 — Demo build script
 * Produces a single self-contained HTML file with all live data embedded.
 * The output needs no server, no Node.js, no database — just open in a browser.
 *
 * Usage:  node build-demo.js
 * Output: ProQuote-Demo.html  (in the project root)
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

const SERVER = 'http://localhost:3000';
const SRC    = path.join(__dirname, 'public', 'index.html');
const OUT    = path.join(__dirname, 'ProQuote-Demo.html');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, body, json: () => JSON.parse(body) }); }
        catch(e) { resolve({ ok: false, body, json: () => ({}) }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('ProQuote Demo Builder');
  console.log('─────────────────────');

  // 1. Check server
  try {
    const health = await get(SERVER + '/api/health');
    if (!health.ok) throw new Error('Server returned ' + health.body);
    console.log('✓ Server reachable at', SERVER);
  } catch(e) {
    console.error('✗ Cannot reach server at', SERVER);
    console.error('  Start it first:  npm start');
    process.exit(1);
  }

  // 2. Fetch all storage key-values (clients, profile, settings, etc.)
  const storageRes = await get(SERVER + '/api/storage');
  if (!storageRes.ok) { console.error('✗ Could not fetch /api/storage'); process.exit(1); }
  const storageData = storageRes.json();
  console.log('✓ Fetched storage (' + Object.keys(storageData).length + ' keys)');

  // 3. Fetch open quote tabs (session)
  let sessionQuotes = [];
  try {
    const raw = storageData['proquote_session_quotes'];
    if (raw) sessionQuotes = JSON.parse(raw);
    console.log('✓ Found ' + sessionQuotes.length + ' open quote tab(s)');
  } catch(e) { /* no open tabs — fine */ }

  // 4. Read source HTML
  let html = fs.readFileSync(SRC, 'utf8');
  console.log('✓ Read source HTML (' + (html.length / 1024).toFixed(0) + ' KB)');

  // 5. Replace the API storage shim with an offline shim that seeds from embedded data
  const SHIM_START = '// ── ProQuote 2.1 — API Storage Shim ─────────────────────────────────────────';
  const SHIM_END   = '})();\n</script>';

  const shimStart = html.indexOf(SHIM_START);
  const shimEnd   = html.indexOf(SHIM_END, shimStart) + SHIM_END.length;

  if (shimStart === -1) {
    console.error('✗ Could not find storage shim marker in index.html');
    process.exit(1);
  }

  const embeddedData = JSON.stringify(storageData);

  const offlineShim = `// ── ProQuote 2.1 — Offline Demo Shim ───────────────────────────────────────
// All data is embedded at build time. Writes stay in-memory (and optionally
// in native localStorage) — nothing is sent to any server.
(function () {
  // Seed from build-time snapshot
  const _seed = ${embeddedData};
  const _ls = Object.assign({}, _seed);

  function _persist() {
    // Best-effort write to native localStorage so refreshes survive
    try {
      Object.entries(_ls).forEach(([k, v]) => window._nativeLS.setItem(k, v));
    } catch(e) {}
  }

  // Keep a reference to the real localStorage before we override it
  window._nativeLS = window.localStorage;
  // Try to seed native localStorage too
  try {
    Object.entries(_seed).forEach(([k, v]) => window._nativeLS.setItem(k, v));
  } catch(e) {}

  const _shim = {
    getItem(key)        { return Object.prototype.hasOwnProperty.call(_ls, key) ? _ls[key] : null; },
    setItem(key, value) { _ls[key] = typeof value === 'string' ? value : JSON.stringify(value); _persist(); },
    removeItem(key)     { delete _ls[key]; _persist(); },
    clear()             { Object.keys(_ls).forEach(k => delete _ls[k]); _persist(); },
    key(i)              { return Object.keys(_ls)[i] ?? null; },
    get length()        { return Object.keys(_ls).length; },
  };

  Object.defineProperty(window, 'localStorage', { get() { return _shim; }, configurable: true });

  // No-op server calls — demo mode has no backend
  window._saveQuoteToServer   = function() {};
  window._deleteQuoteFromServer = function() {};

  // _initStorage resolves immediately — data is already in _ls
  window._initStorage = async function () { /* data pre-seeded */ };
})();
</script>`;

  html = html.slice(0, shimStart) + offlineShim + html.slice(shimEnd);

  // 6. Disable email send (show a demo-mode toast instead of hitting /api/email)
  //    Replace the fetch('/api/email') call body with a toast notice.
  html = html.replace(
    /const res = await fetch\('\/api\/email'/,
    `// Demo mode: email disabled\n      showToast('📧 Email send is disabled in the demo build.', 4000);\n      return;\n      const res = await fetch('/api/email'`
  );

  // 7. Write output
  fs.writeFileSync(OUT, html, 'utf8');
  const sizeKB = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log('');
  console.log('✅ Demo file written: ProQuote-Demo.html (' + sizeKB + ' KB)');
  console.log('');
  console.log('Share instructions:');
  console.log('  1. Send ProQuote-Demo.html to anyone');
  console.log('  2. They open it in Chrome or Safari — no install needed');
  console.log('  3. Log in with your usual ProQuote username + password');
  console.log('  4. All your clients, quotes and data will be there');
  console.log('  5. Changes they make stay in their browser only');
  console.log('');
  console.log('Note: Email sending is disabled. PDF export works via browser print (Cmd+P / Save as PDF).');
}

main().catch(e => { console.error('Build failed:', e); process.exit(1); });
