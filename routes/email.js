const express    = require('express');
const router     = express.Router();
const nodemailer = require('nodemailer');
const path       = require('path');
const fs         = require('fs');
const { PDFDocument } = require('pdf-lib');
const db         = require('../db');

const LOGO_PATH = path.join(__dirname, '../public/logo.png');

// Detect system Chromium once at startup (Railway uses nixpkgs Chromium)
let _chromiumPath = process.env.CHROME_EXECUTABLE_PATH || null;
if (!_chromiumPath) {
  try {
    const { execSync } = require('child_process');
    _chromiumPath = execSync('which chromium || which chromium-browser || which google-chrome', { stdio: 'pipe' }).toString().trim();
  } catch(e) { /* will fall back to puppeteer's bundled Chromium */ }
}

async function generatePDF(html) {
  const puppeteer = require('puppeteer');
  const launchOpts = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
  };
  if (_chromiumPath) {
    launchOpts.executablePath = _chromiumPath;
  }
  const browser = await puppeteer.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '14mm', right: '14mm' },
    });
  } finally {
    await browser.close();
  }
}

function buildTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env');
  // Use explicit host/port instead of service:'gmail' shorthand.
  // Port 587 + STARTTLS works on most cloud providers (incl. Railway).
  // Port 465 (SSL) is often blocked by cloud firewalls.
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,          // STARTTLS — upgrades automatically
    auth: { user, pass },
    connectionTimeout: 60000,
    greetingTimeout:   30000,
    socketTimeout:     60000,
  });
}

function buildSignatureHTML() {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,Arial,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.6">
  <tr>
    <td style="padding-bottom:10px">
      <img src="cid:adonai-logo" alt="Adonai Electrical" style="height:56px;display:block">
    </td>
  </tr>
  <tr><td><strong>Luke Gallagher</strong> - Director | Licensed Electrician</td></tr>
  <tr><td><strong>Mobile:</strong> 0407 769 296</td></tr>
  <tr><td><strong>Email:</strong> <a href="mailto:Luke@adonaielectrical.com" style="color:#1a1a1a">Luke@adonaielectrical.com</a></td></tr>
  <tr><td><strong>Site:</strong> <a href="http://www.adonaielectrical.com" style="color:#1a1a1a">www.adonaielectrical.com</a></td></tr>
</table>`;
}

function buildHTMLEmail(bodyText) {
  const paragraphs = (bodyText || '')
    .split('\n')
    .map(line => line.trim() ? `<p style="margin:0 0 10px">${line}</p>` : '<br>')
    .join('\n  ');

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.7;margin:0;padding:20px">
  ${paragraphs}
  <br>
  ${buildSignatureHTML()}
</body>
</html>`;
}

// POST /api/email
router.post('/', async (req, res) => {
  const { to, subject: customSubject, body: customBody, clientName, jobName, jobNumber, ref, siteAddr, html } = req.body || {};

  if (!to)   return res.status(400).json({ error: 'No recipient email address' });
  if (!html) return res.status(400).json({ error: 'No quote HTML provided' });

  const firstName = (clientName || 'there').split(' ')[0];
  const subject   = customSubject || ['Quote', ref, jobName ? '— ' + jobName : ''].filter(Boolean).join(' ');

  try {
    let [pdf, transporter] = await Promise.all([
      generatePDF(html),
      Promise.resolve(buildTransporter()),
    ]);

    // Append T&C PDF if the user has one stored
    try {
      const { rows: tcRows } = await db.query(
        "SELECT value FROM settings WHERE key = 'proquote_tc_pdf' AND user_id = $1",
        [req.user.userId]
      );
      if (tcRows.length && tcRows[0].value) {
        const tcBase64 = tcRows[0].value
          .replace(/^"?data:application\/pdf;base64,/, '')
          .replace(/"$/, '');
        const quotePdfDoc = await PDFDocument.load(pdf);
        const tcPdfDoc    = await PDFDocument.load(Buffer.from(tcBase64, 'base64'));
        const mergedDoc   = await PDFDocument.create();
        const quotePages  = await mergedDoc.copyPages(quotePdfDoc, quotePdfDoc.getPageIndices());
        quotePages.forEach(p => mergedDoc.addPage(p));
        const tcPages     = await mergedDoc.copyPages(tcPdfDoc, tcPdfDoc.getPageIndices());
        tcPages.forEach(p => mergedDoc.addPage(p));
        const mergedPdf   = await mergedDoc.save();
        pdf = Buffer.from(mergedPdf);
      }
    } catch (tcErr) {
      console.error('[Email] T&C merge failed, sending original PDF:', tcErr.message);
    }

    const logoBuffer = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;

    await transporter.sendMail({
      from:    `"Adonai Electrical" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text:    customBody || '',
      html:    buildHTMLEmail(customBody),
      attachments: [
        {
          filename:    [ref || 'Quote', clientName].filter(Boolean).join(' - ') + '.pdf',
          content:     pdf,
          contentType: 'application/pdf',
        },
        ...(logoBuffer ? [{
          filename:    'logo.png',
          content:     logoBuffer,
          cid:         'adonai-logo',
        }] : []),
      ],
    });

    // Confirmation email to self
    const sentAt = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'short', timeStyle: 'short' });
    const confirmRows = [
      ['Sent to',     to],
      ['Client',      clientName  || '—'],
      ['Job name',    jobName     || '—'],
      ['Job number',  jobNumber   || '—'],
      ['Quote ref',   ref         || '—'],
      ['Site',        siteAddr    || '—'],
      ['Subject',     subject],
      ['Sent at',     sentAt],
    ].map(([label, val]) =>
      `<tr><td style="padding:6px 12px;font-weight:600;white-space:nowrap;color:#555">${label}</td><td style="padding:6px 12px">${val}</td></tr>`
    ).join('');

    await transporter.sendMail({
      from:    `"ProQuote" <${process.env.GMAIL_USER}>`,
      to:      process.env.GMAIL_USER,
      subject: `✅ Quote sent — ${ref || ''}${jobName ? ' — ' + jobName : ''}`,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,Arial,sans-serif;font-size:14px;color:#1a1a1a;padding:20px">
        <p style="margin:0 0 16px"><strong>Quote successfully sent.</strong></p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
          ${confirmRows}
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#888">Sent via ProQuote</p>
      </body></html>`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Email send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
