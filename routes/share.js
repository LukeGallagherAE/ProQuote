const express    = require('express');
const crypto     = require('crypto');
const db         = require('../db');
const requireAuth = require('../middleware/requireAuth');

const apiRouter = express.Router();

// POST /api/share — create a shareable link snapshot
apiRouter.post('/', requireAuth, async (req, res) => {
  const { quoteData } = req.body;
  if (!quoteData) return res.status(400).json({ error: 'quoteData required' });

  const token = crypto.randomBytes(24).toString('hex');
  try {
    await db.query(
      `INSERT INTO quote_links (token, user_id, quote_data, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [token, req.user.userId, JSON.stringify(quoteData)]
    );
    res.json({ token });
  } catch (err) {
    console.error('POST /api/share:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/share/:token/status — acceptance status (for quote owner)
apiRouter.get('/:token/status', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT token, accepted_at, client_name, selections, created_at
       FROM quote_links WHERE token = $1 AND user_id = $2`,
      [req.params.token, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Public page renderer ──────────────────────────────────────────────────────

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'}); }
  catch { return ''; }
}

function renderQuotePage(link) {
  const q     = link.quote_data;
  const f     = q.fields  || {};
  const p     = q.profile || {};
  const secs  = q.sections || [];
  const token = link.token;
  const done  = !!link.accepted_at;

  // Pre-calculate req total / opt total from snapshot values
  let reqTotal = 0, hasOpt = false;
  secs.forEach(sec => (sec.parents||[]).forEach(par => {
    const excluded = par.optional && par.selected === false;
    const t = par._total || 0;
    if (!excluded) {
      if (par.optional) { hasOpt = true; /* counted via client-side */ }
      else reqTotal += t;
    }
  }));

  // Per-section HTML
  let bodyRows = '';
  secs.forEach(sec => {
    const pars = sec.parents || [];
    if (!pars.length) return;
    if (sec.name) {
      bodyRows += `<tr><td colspan="3" style="padding:8px 16px 4px;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#6366f1;background:#fafafa;border-bottom:1px solid #e5e7eb">${esc(sec.name)}</td></tr>`;
    }
    pars.forEach((par, idx) => {
      const isOpt     = !!par.optional;
      const excluded  = isOpt && par.selected === false;
      const total     = par._total || 0;
      const discAmt   = par._discAmt || 0;
      const isLast    = idx === pars.length - 1;
      const rowBg     = isOpt ? (excluded ? '#fff8f8' : '#fffbf0') : '#fff';
      const borderClr = isLast ? '#e0e0e0' : '#f0f0f0';

      const cb = isOpt
        ? `<input type="checkbox" class="opt-cb" data-id="${par.id}" data-amt="${total}" ${excluded ? '' : 'checked'} onchange="updateTotals()" style="width:16px;height:16px;accent-color:#e08000;cursor:pointer;flex-shrink:0;margin-top:3px">`
        : '';
      const badge = isOpt
        ? `<span style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:#fff3cd;color:#b06000;border:1px solid rgba(200,140,0,.3);border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:middle">Optional</span>`
        : '';
      const amtHtml = excluded
        ? `<span style="opacity:.35">$0.00</span>`
        : (discAmt > 0
            ? `<div style="font-size:10px;color:#dc2626;font-weight:600">−$${discAmt.toFixed(2)}</div><div>$${total.toFixed(2)}</div>`
            : `$${total.toFixed(2)}`);

      bodyRows += `
        <tr style="background:${rowBg}" id="row-${par.id}">
          <td style="padding:12px 16px;border-bottom:1px solid ${borderClr};font-size:13px;vertical-align:top">
            <div style="display:flex;align-items:flex-start;gap:8px">
              ${cb}
              <div>
                <div style="font-weight:600;color:#111;line-height:1.4">${esc(par.name)}${badge}</div>
                ${par.description ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;font-style:italic">${esc(par.description)}</div>` : ''}
              </div>
            </div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid ${borderClr};text-align:center;font-size:13px;color:#6b7280;vertical-align:top">${par.qty||1}</td>
          <td class="par-amt" data-id="${par.id}" style="padding:12px 16px;border-bottom:1px solid ${borderClr};text-align:right;font-size:13px;font-weight:700;color:${isOpt?'#b06000':'#111'};vertical-align:top;font-family:monospace;white-space:nowrap">${amtHtml}</td>
        </tr>`;
    });
  });

  // Items array for client JS
  const itemsJson = JSON.stringify(
    secs.flatMap(sec => (sec.parents||[]).map(par => ({
      id:       par.id,
      optional: !!par.optional,
      selected: par.selected !== false,
      total:    par._total || 0,
      discAmt:  par._discAmt || 0,
    })))
  );

  const bizName    = p.bizName   || '';
  const clientName = f.clientName || '';
  const siteAddr   = f.siteAddr  || '';
  const quoteRef   = f.quoteRef  || '';
  const notes      = f.quoteNotes || '';

  // ── Accepted banner or sign form ─────────────────────────────────────────────
  const bottomSection = done ? `
    <div style="background:#f0fdf4;border:2px solid #4ade80;border-radius:12px;padding:32px;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">✅</div>
      <div style="font-size:20px;font-weight:800;color:#166534">Quote Accepted</div>
      <div style="color:#166534;margin-top:6px;font-size:14px">Accepted by <strong>${esc(link.client_name)}</strong></div>
      <div style="color:#6b7280;font-size:13px;margin-top:4px">${fmtDate(link.accepted_at)}</div>
    </div>` : `
    <div id="sign-section">
      <h3 style="font-size:16px;font-weight:700;color:#111;margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid #e5e7eb">Accept &amp; Sign</h3>
      <div style="margin-bottom:16px">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Your full name</label>
        <input id="name-inp" type="text" placeholder="e.g. John Smith" style="width:100%;max-width:380px;padding:10px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;transition:border-color .15s" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#d1d5db'">
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Signature <span style="font-weight:400;color:#9ca3af">(draw below)</span></label>
        <div style="position:relative;display:inline-block;max-width:100%">
          <canvas id="sig-pad" width="480" height="160" style="border:1.5px solid #d1d5db;border-radius:8px;background:#fff;cursor:crosshair;display:block;width:100%;max-width:480px;height:160px;touch-action:none"></canvas>
          <button onclick="clearSig()" style="position:absolute;bottom:8px;right:8px;padding:3px 10px;font-size:11px;border:1px solid #d1d5db;border-radius:5px;background:#fff;color:#6b7280;cursor:pointer">Clear</button>
        </div>
        <div id="sig-err" style="color:#dc2626;font-size:12px;margin-top:4px;display:none">Please add your signature before submitting.</div>
      </div>
      <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:20px">
        <input id="terms-cb" type="checkbox" style="margin-top:2px;width:16px;height:16px;accent-color:#3b82f6;flex-shrink:0">
        <span style="font-size:13px;color:#374151;line-height:1.55">I agree to this quote and authorise the work to proceed as described. I understand payment is required as outlined above.</span>
      </label>
      <button id="accept-btn" onclick="submitAcceptance()" style="padding:13px 36px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.2px;transition:opacity .15s">Accept Quote</button>
      <div id="submit-err" style="color:#dc2626;font-size:13px;margin-top:10px;display:none"></div>
    </div>
    <div id="accepted-banner" style="display:none;background:#f0fdf4;border:2px solid #4ade80;border-radius:12px;padding:32px;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">✅</div>
      <div style="font-size:20px;font-weight:800;color:#166534">Quote Accepted</div>
      <div style="color:#166534;margin-top:6px;font-size:14px">Thank you! We'll be in touch shortly to confirm your booking.</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quote${quoteRef ? ' #'+esc(quoteRef) : ''}${bizName ? ' — '+esc(bizName) : ''}</title>
<style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;color:#111;-webkit-font-smoothing:antialiased}
.wrap{max-width:780px;margin:0 auto;padding:16px}
@media(min-width:640px){.wrap{padding:32px 24px}}
.card{background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px;overflow:hidden}
table{width:100%;border-collapse:collapse}
canvas{display:block;max-width:100%}
</style>
</head>
<body>
<div class="wrap">

  <!-- Header card -->
  <div class="card" style="padding:24px 28px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:22px;font-weight:800;color:#111;margin-bottom:4px">${esc(bizName)||'&nbsp;'}</div>
        ${p.abn    ? `<div style="font-size:12px;color:#6b7280">ABN ${esc(p.abn)}</div>` : ''}
        ${p.lic    ? `<div style="font-size:12px;color:#6b7280">Lic ${esc(p.lic)}</div>` : ''}
        ${p.phone  ? `<div style="font-size:12px;color:#6b7280">📞 ${esc(p.phone)}</div>` : ''}
        ${p.email  ? `<div style="font-size:12px;color:#6b7280">✉ ${esc(p.email)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6366f1;margin-bottom:4px">Quotation</div>
        ${quoteRef ? `<div style="font-size:20px;font-weight:800;color:#111">#${esc(quoteRef)}</div>` : ''}
        ${f.quoteDate ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${fmtDate(f.quoteDate)}</div>` : ''}
        ${p.preparedBy ? `<div style="font-size:12px;color:#6b7280">Prepared by ${esc(p.preparedBy)}</div>` : ''}
      </div>
    </div>
    ${clientName || siteAddr ? `
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid #f0f0f0">
      ${clientName ? `<div style="font-size:13px;margin-bottom:2px"><span style="color:#9ca3af">To: </span><strong>${esc(clientName)}</strong></div>` : ''}
      ${siteAddr   ? `<div style="font-size:13px;color:#6b7280">${esc(siteAddr)}</div>` : ''}
    </div>` : ''}
  </div>

  <!-- Line items -->
  <div class="card">
    ${hasOpt ? `<div style="padding:10px 16px;background:#fffbf0;border-bottom:1px solid #ffe9a0;font-size:12px;color:#b06000;line-height:1.5">
      ☑ <strong>Optional items</strong> are pre-selected — tick or untick them to adjust your total.
    </div>` : ''}
    <table>
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb">Description</th>
          <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;white-space:nowrap">Qty</th>
          <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;white-space:nowrap">Total</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="card">
    <table>
      <tbody>
        <tr id="opt-row" style="${hasOpt ? '' : 'display:none'}">
          <td style="padding:10px 16px;font-size:13px;color:#b06000;text-align:right" colspan="2">Optional extras (selected)</td>
          <td id="opt-amt" style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right;font-family:monospace;color:#b06000;white-space:nowrap"></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;text-align:right" colspan="2">Subtotal (excl. GST)</td>
          <td id="sub-amt" style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right;font-family:monospace;white-space:nowrap"></td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#6b7280;text-align:right" colspan="2">GST (10%)</td>
          <td id="gst-amt" style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right;font-family:monospace;white-space:nowrap"></td>
        </tr>
        <tr style="background:#1d4ed8">
          <td style="padding:14px 16px;font-size:15px;font-weight:700;color:#fff;text-align:right" colspan="2">Total AUD inc. GST</td>
          <td id="total-amt" style="padding:14px 16px;font-size:17px;font-weight:800;text-align:right;font-family:monospace;color:#fbbf24;white-space:nowrap"></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${notes ? `
  <!-- Notes -->
  <div class="card" style="padding:20px 24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Notes</div>
    <div style="font-size:13px;color:#374151;line-height:1.65;white-space:pre-wrap">${esc(notes)}</div>
  </div>` : ''}

  ${p.bankName||p.bankBSB||p.bankAcc ? `
  <!-- Payment details -->
  <div class="card" style="padding:20px 24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px">Payment Details</div>
    <div style="font-size:13px;color:#374151;line-height:1.8">
      ${p.bankName ? `<div><span style="color:#9ca3af">Account Name </span>${esc(p.bankName)}</div>` : ''}
      ${p.bankBSB  ? `<div><span style="color:#9ca3af">BSB </span>${esc(p.bankBSB)}</div>` : ''}
      ${p.bankAcc  ? `<div><span style="color:#9ca3af">Account No </span>${esc(p.bankAcc)}</div>` : ''}
    </div>
  </div>` : ''}

  <!-- Sign / Accepted section -->
  <div class="card" style="padding:24px 28px">
    ${bottomSection}
  </div>

  <div style="text-align:center;padding:20px 0 8px;font-size:11px;color:#d1d5db">
    Powered by ProQuote
  </div>
</div>

<script>
var _reqTotal = ${reqTotal};
var _items    = ${itemsJson};
var _token    = ${JSON.stringify(token)};
var _sigHasContent = false;

function fmtAmt(n) {
  return '$' + Number(n||0).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
}

function updateTotals() {
  var optSum = 0;
  document.querySelectorAll('.opt-cb').forEach(function(cb) {
    var id  = cb.dataset.id;
    var amt = parseFloat(cb.dataset.amt) || 0;
    var item = _items.find(function(i){ return String(i.id) === String(id); });
    var row  = document.getElementById('row-' + id);
    var cell = document.querySelector('.par-amt[data-id="' + id + '"]');
    if (cb.checked) {
      optSum += amt;
      if (row) row.style.opacity = '1';
      if (cell && item) {
        cell.innerHTML = item.discAmt > 0
          ? '<div style="font-size:10px;color:#dc2626;font-weight:600">−$'+item.discAmt.toFixed(2)+'</div><div>$'+amt.toFixed(2)+'</div>'
          : '$'+amt.toFixed(2);
      }
    } else {
      if (row) row.style.opacity = '.45';
      if (cell) cell.innerHTML = '<span style="opacity:.35">$0.00</span>';
    }
  });
  var sub   = _reqTotal + optSum;
  var gst   = sub * 0.1;
  var total = sub + gst;
  document.getElementById('sub-amt').textContent   = fmtAmt(sub);
  document.getElementById('gst-amt').textContent   = fmtAmt(gst);
  document.getElementById('total-amt').textContent = fmtAmt(total);
  var optRow = document.getElementById('opt-row');
  var optAmt = document.getElementById('opt-amt');
  if (optSum > 0) { optRow.style.display=''; optAmt.textContent=fmtAmt(optSum); }
  else            { optRow.style.display='none'; }
}

// Init totals on load
window.addEventListener('DOMContentLoaded', function() { updateTotals(); });

// ── Signature pad ────────────────────────────────────────────────────────────
var _canvas = document.getElementById('sig-pad');
var _ctx    = _canvas ? _canvas.getContext('2d') : null;
var _drawing = false;

function _pos(e, c) {
  var r = c.getBoundingClientRect();
  var sx = c.width  / r.width;
  var sy = c.height / r.height;
  var cx = (e.clientX != null ? e.clientX : e.touches[0].clientX);
  var cy = (e.clientY != null ? e.clientY : e.touches[0].clientY);
  return { x: (cx - r.left) * sx, y: (cy - r.top) * sy };
}

if (_ctx) {
  _ctx.strokeStyle = '#111';
  _ctx.lineWidth   = 2.2;
  _ctx.lineCap     = 'round';
  _ctx.lineJoin    = 'round';

  _canvas.addEventListener('mousedown',  function(e){ _drawing=true; _sigHasContent=true; var p=_pos(e,_canvas); _ctx.beginPath(); _ctx.moveTo(p.x,p.y); });
  _canvas.addEventListener('mousemove',  function(e){ if(!_drawing)return; var p=_pos(e,_canvas); _ctx.lineTo(p.x,p.y); _ctx.stroke(); });
  _canvas.addEventListener('mouseup',    function(){ _drawing=false; });
  _canvas.addEventListener('mouseleave', function(){ _drawing=false; });
  _canvas.addEventListener('touchstart', function(e){ e.preventDefault(); _drawing=true; _sigHasContent=true; var p=_pos(e,_canvas); _ctx.beginPath(); _ctx.moveTo(p.x,p.y); }, {passive:false});
  _canvas.addEventListener('touchmove',  function(e){ e.preventDefault(); if(!_drawing)return; var p=_pos(e,_canvas); _ctx.lineTo(p.x,p.y); _ctx.stroke(); }, {passive:false});
  _canvas.addEventListener('touchend',   function(){ _drawing=false; });
}

function clearSig() {
  if (_ctx) { _ctx.clearRect(0, 0, _canvas.width, _canvas.height); _sigHasContent=false; }
}

// ── Accept submission ─────────────────────────────────────────────────────────
function submitAcceptance() {
  var nameEl  = document.getElementById('name-inp');
  var termsEl = document.getElementById('terms-cb');
  var sigErr  = document.getElementById('sig-err');
  var subErr  = document.getElementById('submit-err');
  var btn     = document.getElementById('accept-btn');

  sigErr.style.display = 'none';
  subErr.style.display = 'none';

  if (!nameEl.value.trim()) {
    subErr.textContent = 'Please enter your full name.';
    subErr.style.display = '';
    nameEl.focus();
    return;
  }
  if (!_sigHasContent) {
    sigErr.style.display = '';
    return;
  }
  if (!termsEl.checked) {
    subErr.textContent = 'Please tick the authorisation checkbox to proceed.';
    subErr.style.display = '';
    return;
  }

  // Collect optional selections
  var selections = {};
  document.querySelectorAll('.opt-cb').forEach(function(cb){ selections[cb.dataset.id]=cb.checked; });

  btn.disabled     = true;
  btn.textContent  = 'Submitting…';
  btn.style.opacity = '.7';

  fetch('/q/' + _token + '/accept', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      clientName: nameEl.value.trim(),
      signature:  _canvas.toDataURL('image/png'),
      selections: selections
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.ok) {
      document.getElementById('sign-section').style.display   = 'none';
      document.getElementById('accepted-banner').style.display = '';
    } else {
      subErr.textContent = d.error || 'Submission failed — please try again.';
      subErr.style.display = '';
      btn.disabled = false; btn.textContent = 'Accept Quote'; btn.style.opacity='1';
    }
  })
  .catch(function(){
    subErr.textContent = 'Network error — please check your connection and try again.';
    subErr.style.display = '';
    btn.disabled = false; btn.textContent = 'Accept Quote'; btn.style.opacity='1';
  });
}
</script>
</body>
</html>`;
}

module.exports = { apiRouter, renderQuotePage };
