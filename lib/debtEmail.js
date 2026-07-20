// Wholesaler debt tracking — balance calculation + summary email sending.
// Shared between routes/wholesalers.js (on-demand "send now") and the
// scheduled monthly check in server.js.
const db = require('../db');
const { Resend } = require('resend');

const CONFIG_KEY = 'wholesaler_debt_email_config';

function defaultConfig() {
  return {
    enabled: false,
    day: 1,
    recipient: process.env.GMAIL_USER || 'luke@adonaielectrical.com',
    lastSentPeriod: null,
  };
}

async function getConfig(userId) {
  const { rows } = await db.query('SELECT value FROM settings WHERE key=$1 AND user_id=$2', [CONFIG_KEY, userId]);
  if (!rows.length || !rows[0].value) return defaultConfig();
  try { return { ...defaultConfig(), ...JSON.parse(rows[0].value) }; }
  catch { return defaultConfig(); }
}

async function saveConfig(userId, config) {
  await db.query(
    `INSERT INTO settings (key, value, user_id) VALUES ($1,$2,$3)
     ON CONFLICT (key, user_id) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [CONFIG_KEY, JSON.stringify(config), userId]
  );
}

// Current unpaid balance per wholesaler for a user.
async function getBalances(userId) {
  const { rows } = await db.query(
    `SELECT w.id, w.name,
            COALESCE(SUM(c.amount) FILTER (WHERE c.paid = FALSE), 0)::numeric AS balance,
            MAX(c.charge_date) FILTER (WHERE c.paid = FALSE) AS last_charge_date
     FROM wholesalers w
     LEFT JOIN wholesaler_charges c ON c.wholesaler_id = w.id AND c.user_id = w.user_id
     WHERE w.user_id = $1
     GROUP BY w.id, w.name
     ORDER BY w.name`,
    [userId]
  );
  return rows.map(r => ({ id: r.id, name: r.name, balance: Number(r.balance), lastChargeDate: r.last_charge_date }));
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function sendDebtSummaryEmail(userId, { recipientOverride } = {}) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set — add it in Railway Variables');

  const balances = await getBalances(userId);
  const config = await getConfig(userId);
  const to = recipientOverride || config.recipient || process.env.GMAIL_USER || 'luke@adonaielectrical.com';
  const grandTotal = balances.reduce((s, b) => s + b.balance, 0);

  const rowsHtml = balances.length
    ? balances.map(b =>
        `<tr><td style="padding:8px 14px;border-bottom:1px solid #eee">${b.name}</td>` +
        `<td style="padding:8px 14px;border-bottom:1px solid #eee;text-align:right;font-family:monospace">${fmtMoney(b.balance)}</td></tr>`
      ).join('')
    : `<tr><td colspan="2" style="padding:14px;color:#888">No wholesaler accounts set up yet.</td></tr>`;

  const dateStr = new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Arial,sans-serif;font-size:14px;color:#1a1a1a;padding:24px">
    <h2 style="margin:0 0 4px">Wholesaler debt summary</h2>
    <p style="margin:0 0 20px;color:#666;font-size:12px">${dateStr}</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:480px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
      ${rowsHtml}
      <tr><td style="padding:10px 14px;font-weight:700;background:#f7f7f7">Total owing</td><td style="padding:10px 14px;font-weight:700;background:#f7f7f7;text-align:right;font-family:monospace">${fmtMoney(grandTotal)}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:11px;color:#aaa">Sent via ProQuote</p>
  </body></html>`;

  const text = balances.map(b => `${b.name}: ${fmtMoney(b.balance)}`).join('\n') + `\n\nTotal owing: ${fmtMoney(grandTotal)}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = `ProQuote <${process.env.GMAIL_USER || 'Luke@adonaielectrical.com'}>`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: `Wholesaler debt summary — ${fmtMoney(grandTotal)} owing`,
    html,
    text,
  });
  if (error) throw new Error(error.message || JSON.stringify(error));

  return { grandTotal, balances };
}

// Polled hourly by server.js. Sends the monthly email for any user whose
// config is enabled, whose chosen day-of-month (Sydney time) has arrived,
// and who hasn't already been sent one this period.
async function checkAndSendScheduled() {
  const { rows } = await db.query('SELECT user_id, value FROM settings WHERE key=$1 AND user_id IS NOT NULL', [CONFIG_KEY]);
  if (!rows.length) return;

  const sydneyToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [year, month, day] = sydneyToday.split('-').map(Number);
  const currentPeriod = `${year}-${String(month).padStart(2, '0')}`;

  for (const row of rows) {
    let config;
    try { config = JSON.parse(row.value); } catch { continue; }
    if (!config || !config.enabled) continue;
    if (config.lastSentPeriod === currentPeriod) continue;
    if (day < Number(config.day || 1)) continue;
    try {
      await sendDebtSummaryEmail(row.user_id);
      config.lastSentPeriod = currentPeriod;
      await saveConfig(row.user_id, config);
      console.log(`[ProQuote] Sent monthly wholesaler debt summary for user ${row.user_id}`);
    } catch (err) {
      console.error(`[ProQuote] Failed to send debt summary for user ${row.user_id}:`, err.message);
    }
  }
}

module.exports = { getConfig, saveConfig, getBalances, sendDebtSummaryEmail, checkAndSendScheduled, fmtMoney };
