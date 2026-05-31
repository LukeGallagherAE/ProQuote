#!/usr/bin/env node
// Run from your local machine: node cleanup-quotes.js
// Deletes all Q-2026-001 quotes (and any revision) from the server.

const BASE = 'https://proquote-app-production.up.railway.app';
const EMAIL = 'luke@adonaielectrical.com';
const PASSWORD = 'E7doa6__!';

// Any quote whose name/ref contains one of these strings will be deleted.
const DELETE_PATTERNS = ['2026-001', '2026001', 'Q-2026-001'];

async function run() {
  // 1. Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) { console.error('Login failed:', loginRes.status, await loginRes.text()); process.exit(1); }
  const { token } = await loginRes.json();
  console.log('Logged in OK');

  // 2. Fetch all quotes
  const quotesRes = await fetch(`${BASE}/api/quotes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!quotesRes.ok) { console.error('Fetch quotes failed:', quotesRes.status); process.exit(1); }
  const rows = await quotesRes.json();
  console.log(`Total quotes on server: ${rows.length}`);

  // 3. Find matches
  const toDelete = rows.filter(row => {
    const name = (row.name || '').toLowerCase();
    let ref = '';
    try {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      ref = (data?.fields?.quoteRef || data?.quoteRef || '').toLowerCase();
    } catch(e) {}
    return DELETE_PATTERNS.some(p => name.includes(p.toLowerCase()) || ref.includes(p.toLowerCase()));
  });

  if (!toDelete.length) { console.log('No matching quotes found — nothing to delete.'); return; }

  console.log(`\nFound ${toDelete.length} quote(s) to delete:`);
  toDelete.forEach(r => console.log(`  id=${r.id}  name="${r.name}"`));
  console.log('');

  // 4. Delete each
  let ok = 0, fail = 0;
  for (const row of toDelete) {
    const del = await fetch(`${BASE}/api/quotes/${row.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (del.ok) { console.log(`  ✓ deleted ${row.id} "${row.name}"`); ok++; }
    else { console.log(`  ✗ FAILED ${row.id} (${del.status})`); fail++; }
  }

  console.log(`\nDone — ${ok} deleted, ${fail} failed.`);
}

run().catch(e => { console.error(e); process.exit(1); });
